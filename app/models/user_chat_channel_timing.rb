# frozen_string_literal: true

class UserChatChannelTiming < ActiveRecord::Base
  belongs_to :user
  belongs_to :chat_channel
  belongs_to :chat_message
end
