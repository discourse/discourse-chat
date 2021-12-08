# frozen_string_literal: true

require 'rails_helper'

RSpec.describe DiscourseChat::IncomingChatWebhooksController do
  fab!(:chat_channel) { Fabricate(:chat_channel) }
  fab!(:webhook) { Fabricate(:incoming_chat_webhook, chat_channel: chat_channel) }

  describe "#create_message" do
    it "errors with invalid key" do
      post '/chat/hooks/null.json'
      expect(response.status).to eq(400)
    end

    it "errors when no body is present" do
      post "/chat/hooks/#{webhook.key}.json"
      expect(response.status).to eq(400)
    end

    it "errors when the body is over 1000 characters" do
      post "/chat/hooks/#{webhook.key}.json", params: { body: "$" * 1001 }
      expect(response.status).to eq(400)
    end

    it "creates a new chat message" do
      expect {
        post "/chat/hooks/#{webhook.key}.json", params: { body: "A new signup woo!" }
      }.to change { ChatMessage.where(chat_channel: chat_channel).count }.by(1)
      expect(response.status).to eq(200)
      chat_webhook_event = ChatWebhookEvent.last
      expect(chat_webhook_event.incoming_chat_webhook_id).to eq(webhook.id)
      expect(chat_webhook_event.chat_message_id).to eq(ChatMessage.last.id)
    end

    it "rate limits" do
      RateLimiter.enable
      RateLimiter.clear_all!
      10.times do
        post "/chat/hooks/#{webhook.key}.json", params: { body: "A new signup woo!" }
      end
      expect(response.status).to eq(200)

      post "/chat/hooks/#{webhook.key}.json", params: { body: "A new signup woo!" }
      expect(response.status).to eq(429)
    end
  end
end
