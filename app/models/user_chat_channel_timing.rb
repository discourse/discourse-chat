# frozen_string_literal: true

class UserChatChannelTiming < ActiveRecord::Base
  attribute :unread_count, default: 0

  belongs_to :user
  belongs_to :chat_channel
  belongs_to :chat_message
end
