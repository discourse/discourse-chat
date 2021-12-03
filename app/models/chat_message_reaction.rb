# frozen_string_literal: true

class ChatMessageReaction < ActiveRecord::Base
  belongs_to :chat_message
  belongs_to :user
end
