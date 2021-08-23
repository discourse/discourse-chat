# frozen_string_literal: true

class ChatWebhookEvent < ActiveRecord::Base
  belongs_to :chat_message
  belongs_to :incoming_chat_webhook
end
