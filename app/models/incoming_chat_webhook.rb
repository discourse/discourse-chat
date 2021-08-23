# frozen_string_literal: true

class IncomingChatWebhook < ActiveRecord::Base
  belongs_to :chat_channel
  belongs_to :upload, optional: true
  has_many :chat_webhook_events

  def url
    "#{Discourse.base_url}/chat/hooks/#{key}.json"
  end
end
