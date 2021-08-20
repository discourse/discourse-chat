# frozen_string_literal: true

class IncomingChatWebhook < ActiveRecord::Base
  belongs_to :chat_channel
  belongs_to :upload, optional: true

  def url
    "#{Discourse.base_url}/chat/hooks/#{key}"
  end
end
