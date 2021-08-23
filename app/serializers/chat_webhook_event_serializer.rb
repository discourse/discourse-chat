# frozen_string_literal: true

class ChatWebhookEventSerializer < ApplicationSerializer
  attributes :username,
             :emoji

  def username
    object.incoming_chat_webhook.username
  end

  def emoji
    object.incoming_chat_webhook.emoji
  end
end
