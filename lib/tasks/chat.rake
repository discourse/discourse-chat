# frozen_string_literal: true

chat_task = Rake::Task['dev:populate']
chat_task.enhance {
  SiteSetting.chat_enabled = true
  DiscourseDev::PublicChannel.populate!
  DiscourseDev::DirectChannel.populate!
  DiscourseDev::Message.populate!
}

desc 'Generates sample content for chat'
task 'chat:populate' => ['db:load_config'] do |_, args|
  DiscourseDev::PublicChannel.new.populate!(ignore_current_count: true)
  DiscourseDev::DirectChannel.new.populate!(ignore_current_count: true)
  DiscourseDev::Message.new.populate!(ignore_current_count: true)
end

desc 'Generates sample messages in channels'
task 'chat:message:populate' => ['db:load_config'] do |_, args|
  DiscourseDev::Message.new.populate!(ignore_current_count: true)
end
