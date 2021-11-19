
# frozen_string_literal: true

task 'chat_messages:rebake_uncooked_chat_messages' => :environment do
  # rebaking uncooked chat_messages can very quickly saturate sidekiq
  # this provides an insurance policy so you can safely run and stop
  # this rake task without worrying about your sidekiq imploding
  Jobs.run_immediately!

  ENV['RAILS_DB'] ? rebake_uncooked_chat_messages : rebake_uncooked_chat_messages_all_sites
end

def rebake_uncooked_chat_messages_all_sites
  RailsMultisite::ConnectionManagement.each_connection do |db|
    rebake_uncooked_chat_messages
  end
end

def rebake_uncooked_chat_messages
  puts "Rebaking uncooked posts on #{RailsMultisite::ConnectionManagement.current_db}"
  uncooked = ChatMessage.uncooked

  rebaked = 0
  total = uncooked.count

  ids = uncooked.pluck(:id)
  # work randomly so you can run this job from lots of consoles if needed
  ids.shuffle!

  ids.each do |id|
    # may have been cooked in interim
    chat_message = uncooked.where(id: id).first

    if chat_message
      rebake_chat_message(chat_message)
    end

    print_status(rebaked += 1, total)
  end

  puts "", "#{rebaked} posts done!", ""
end

def rebake_chat_message(chat_message, opts = {})
  if !opts[:priority]
    opts[:priority] = :ultra_low
  end
  chat_message.rebake!(**opts)
rescue => e
  puts "", "Failed to rebake chat message (chat_message_id: #{chat_message.id})", e, e.backtrace.join("\n")
end
