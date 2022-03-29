# frozen_string_literal: true

class ChatMessageEmailStatus < ActiveRecord::Base
  self.inheritance_column = nil # Disable STI due to `type` column

  STATUSES = {
    unprocessed: 0,
    processed: 1,
  }

  TYPES = {
    regular: 0,
    group_mention: 1,
    global_mention: 2,
    direct_mention: 3,
  }

  enum status: STATUSES
  enum status: TYPES
  belongs_to :user
  belongs_to :chat_message

  def self.new_message_created(chat_channel:, chat_message:, mentioned_users_with_identifier:)
    mentioned_user_ids = mentioned_users_with_identifier.keys
    notify_user_ids = []
    if chat_channel.direct_message_channel?
      notify_user_ids = chat_channel.chatable.direct_message_users.map(&:user_id)
      notify_user_ids = notify_user_ids - [chat_message.user_id]
      notify_user_ids = notify_user_ids - mentioned_user_ids
    end

    records = []
    now = Time.now
    mentioned_users_with_identifier.each do |user_id, mention_info|
      records << {
        type: type_from_mention_info(mention_info),
        status: STATUSES[:unprocessed],
        chat_message_id: chat_message.id,
        user_id: user_id,
        created_at: now,
        updated_at: now
      }
    end

    notify_user_ids.each do |user_id|
      records << {
        type: TYPES[:regular],
        status: STATUSES[:unprocessed],
        chat_message_id: chat_message.id,
        user_id: user_id,
        created_at: now,
        updated_at: now
      }
    end

    self.insert_all!(records) if records.any?
  end

  def self.type_from_mention_info(mention_info)
    return TYPES[:direct_mention] if mention_info.nil?
    return TYPES[:group_mention] if mention_info[:is_group]
    return TYPES[:global_mention] if [:all, :here].include?(mention_info[:identifier])
  end
end
