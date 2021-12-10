# frozen_string_literal: true

class ChatMention < ActiveRecord::Base
  belongs_to :user
  belongs_to :chat_message
  belongs_to :notification
end
