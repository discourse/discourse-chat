# frozen_string_literal: true

class UserChatChannelMembership < ActiveRecord::Base
  attribute :unread_count, default: 0

  belongs_to :user
  belongs_to :chat_channel
  belongs_to :last_read_message, class_name: "ChatMessage", optional: true

  enum notification_level: { muted: 0, default: 1, notify: 2 }
end
