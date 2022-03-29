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

  def self.on_new_message_created(chat_channel:, chat_message:, mentioned_user_ids:)
    notify_user_ids = chat_channel.direct_message_channel? ?
      (chat_channel.chatable.direct_message_users.map(&:user_id) - chat_message.user_id) :
      []
  end
end
