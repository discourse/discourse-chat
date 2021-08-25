# frozen_string_literal: true

class IncomingChatWebhook < ActiveRecord::Base
  belongs_to :chat_channel
  has_many :chat_webhook_events

  before_create do
    self.key = SecureRandom.hex(12)
  end

  def url
    "#{Discourse.base_url}/chat/hooks/#{key}.json"
  end
end
