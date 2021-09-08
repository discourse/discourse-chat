# frozen_string_literal: true

class UserChatChannelMembership < ActiveRecord::Base
  attribute :unread_count, default: 0

  belongs_to :user
  belongs_to :chat_channel
  belongs_to :last_read_message, class_name: "ChatMessage", optional: true

  DEFAULT_NOTIFICATION_LEVEL = :mention
  NOTIFICATION_LEVELS = {
    never: 0,
    mention: 1,
    always: 2
  }
  enum desktop_notification_level: NOTIFICATION_LEVELS, _prefix: :desktop
  enum mobile_notification_level: NOTIFICATION_LEVELS, _prefix: :mobile
end
