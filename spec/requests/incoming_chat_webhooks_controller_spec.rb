# frozen_string_literal: true

require 'rails_helper'

RSpec.describe DiscourseChat::IncomingChatWebhooksController do
  fab!(:chat_channel) { Fabricate(:chat_channel) }
  fab!(:webhook) { Fabricate(:incoming_chat_webhook, chat_channel: chat_channel) }

  before do
    SiteSetting.chat_debug_webhook_payloads = true
  end

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
      post "/chat/hooks/#{webhook.key}.json", params: { text: "$" * 1001 }
      expect(response.status).to eq(400)
    end

    it "creates a new chat message" do
      expect {
        post "/chat/hooks/#{webhook.key}.json", params: { text: "A new signup woo!" }
      }.to change { ChatMessage.where(chat_channel: chat_channel).count }.by(1)
      expect(response.status).to eq(200)
      chat_webhook_event = ChatWebhookEvent.last
      expect(chat_webhook_event.chat_message_id).to eq(ChatMessage.last.id)
    end

    it "rate limits" do
      RateLimiter.enable
      RateLimiter.clear_all!
      10.times do
        post "/chat/hooks/#{webhook.key}.json", params: { text: "A new signup woo!" }
      end
      expect(response.status).to eq(200)

      post "/chat/hooks/#{webhook.key}.json", params: { text: "A new signup woo!" }
      expect(response.status).to eq(429)
    end
  end

  describe "#create_message_slack_compatible" do
    it "processes the text param with SlackCompatibility" do
      expect {
        post "/chat/hooks/#{webhook.key}/slack.json", params: { text: "A new signup woo <!here>!" }
      }.to change { ChatMessage.where(chat_channel: chat_channel).count }.by(1)
      expect(response.status).to eq(200)
      expect(ChatMessage.last.message).to eq("A new signup woo @here!")
    end

    it "processes the attachments param with SlackCompatibility, using the fallback" do
      payload_data = {
        attachments: [
          {
            color: "#F4511E",
            title: "New+alert:+#46353",
            text: "\"[StatusCake]+https://www.test_notification.com+(StatusCake+Test+Alert):+Down,\"",
            fallback: "New+alert:+\"[StatusCake]+https://www.test_notification.com+(StatusCake+Test+Alert):+Down,\"+<https://eu.opsg.in/a/i/test/blahguid|46353>\nTags:+",
            title_link: "https://eu.opsg.in/a/i/test/blahguid"
          }
        ],
      }
      expect {
        post "/chat/hooks/#{webhook.key}/slack.json", params: payload_data
      }.to change { ChatMessage.where(chat_channel: chat_channel).count }.by(1)
      expect(ChatMessage.last.message).to eq("New alert: \"[StatusCake] https://www.test_notification.com (StatusCake Test Alert): Down,\" [46353](https://eu.opsg.in/a/i/test/blahguid)\nTags: ")
      expect {
        post "/chat/hooks/#{webhook.key}/slack.json", params: { payload: payload_data }
      }.to change { ChatMessage.where(chat_channel: chat_channel).count }.by(1)
    end

    it "can process the payload when it's a JSON string" do
      payload_data = {
        attachments: [
          {
            color: "#F4511E",
            title: "New+alert:+#46353",
            text: "\"[StatusCake]+https://www.test_notification.com+(StatusCake+Test+Alert):+Down,\"",
            fallback: "New+alert:+\"[StatusCake]+https://www.test_notification.com+(StatusCake+Test+Alert):+Down,\"+<https://eu.opsg.in/a/i/test/blahguid|46353>\nTags:+",
            title_link: "https://eu.opsg.in/a/i/test/blahguid"
          }
        ],
      }
      expect {
        post "/chat/hooks/#{webhook.key}/slack.json", params: { payload: payload_data.to_json }
      }.to change { ChatMessage.where(chat_channel: chat_channel).count }.by(1)
      expect(ChatMessage.last.message).to eq("New alert: \"[StatusCake] https://www.test_notification.com (StatusCake Test Alert): Down,\" [46353](https://eu.opsg.in/a/i/test/blahguid)\nTags: ")
    end
  end
end
