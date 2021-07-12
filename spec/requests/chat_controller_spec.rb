# frozen_string_literal: true

require 'rails_helper'
require_relative '../fabricators/chat_channel_fabricator'

RSpec.describe DiscourseChat::ChatController do
  fab!(:user) { Fabricate(:user) }
  fab!(:admin) { Fabricate(:admin) }
  fab!(:topic) { Fabricate(:topic) }
  fab!(:category) { Fabricate(:category) }

  describe "#enable_chat" do
    describe "for topic" do
      it "errors for non-staff" do
        sign_in(user)
        Fabricate(:chat_channel, chatable: topic)
        post "/chat/enable.json", params: { chatable_type: "topic", chatable_id: topic.id }
        expect(response.status).to eq(403)
      end

      it "Returns a 422 when chat is already enabled" do
        sign_in(admin)
        Fabricate(:chat_channel, chatable: topic)
        post "/chat/enable.json", params: { chatable_type: "topic", chatable_id: topic.id }
        expect(response.status).to eq(422)
      end

      it "Enables chat" do
        sign_in(admin)
        post "/chat/enable.json", params: { chatable_type: "topic", chatable_id: topic.id }
        expect(response.status).to eq(200)
        expect(topic.chat_channel).to be_present
      end
    end
  end

  describe "#disable_chat" do
    describe "for topic" do
      it "errors for non-staff" do
        sign_in(user)
        Fabricate(:chat_channel, chatable: topic)
        post "/chat/disable.json", params: { chatable_type: "topic", chatable_id: topic.id }
        expect(response.status).to eq(403)
      end

      it "Returns a 422 when chat is already disabled" do
        sign_in(admin)
        chat_channel = Fabricate(:chat_channel, chatable: topic)
        chat_channel.update(deleted_at: Time.now, deleted_by_id: admin.id)
        post "/chat/disable.json", params: { chatable_type: "topic", chatable_id: topic.id }
        expect(response.status).to eq(422)
      end

      it "disables chat" do
        sign_in(admin)
        chat_channel = Fabricate(:chat_channel, chatable: topic)
        post "/chat/disable.json", params: { chatable_type: "topic", chatable_id: topic.id }
        expect(response.status).to eq(200)
        expect(chat_channel.reload.deleted_by_id).to eq(admin.id)
      end

    end
  end

  describe "#send_chat" do
    fab!(:chat_channel) { Fabricate(:chat_channel, chatable: topic) }
    let(:message) { "This is a message" }
    before do
      create_post(user: user, topic: topic)
    end

    it "errors for regular user when chat is staff-only" do
      sign_in(user)
      SiteSetting.topic_chat_restrict_to_staff = true

      post "/chat/#{chat_channel.id}.json", params: { message: message }
      expect(response.status).to eq(403)
    end

    it "sends a message for regular user when staff-only is false" do
      sign_in(user)
      SiteSetting.topic_chat_restrict_to_staff = false

      expect {
        post "/chat/#{chat_channel.id}.json", params: { message: message }
      }.to change { ChatMessage.count}.by(1)
      expect(response.status).to eq(200)
      expect(ChatMessage.last.message).to eq(message)
    end
  end

  describe "#delete" do
    fab!(:chat_channel) { Fabricate(:chat_channel, chatable: topic) }
    fab!(:second_user) { Fabricate(:user) }

    before do
      SiteSetting.topic_chat_restrict_to_staff = false
      ChatMessage.create(user: user, message: "this is a message", chat_channel: chat_channel)
    end

    it "doesn't allow a user to delete another user's message" do
      sign_in(second_user)

      delete "/chat/#{chat_channel.id}/#{ChatMessage.last.id}.json"
      expect(response.status).to eq(404)
    end

    it "Allows users to delete their own messages" do
      sign_in(user)

      expect {
        delete "/chat/#{chat_channel.id}/#{ChatMessage.last.id}.json"
      }.to change { ChatMessage.count}.by(-1)
      expect(response.status).to eq(200)
    end

    it "Allows admin to delete others' messages" do
      sign_in(admin)

      expect {
        delete "/chat/#{chat_channel.id}/#{ChatMessage.last.id}.json"
      }.to change { ChatMessage.count}.by(-1)
      expect(response.status).to eq(200)
    end
  end

  describe "#restore" do
    fab!(:chat_channel) { Fabricate(:chat_channel, chatable: topic) }
    fab!(:second_user) { Fabricate(:user) }

    before do
      SiteSetting.topic_chat_restrict_to_staff = false
      message = ChatMessage.create(user: user, message: "this is a message", chat_channel: chat_channel)
      message.update(deleted_at: Time.now, deleted_by_id: user.id)
    end

    it "doesn't allow a user to restore another user's message" do
      sign_in(second_user)

      put "/chat/#{chat_channel.id}/restore/#{ChatMessage.unscoped.last.id}.json"
      expect(response.status).to eq(403)
    end

    it "doesn't allow restoration of posts on closed topics" do
      sign_in(user)
      topic.update(closed: true)

      put "/chat/#{chat_channel.id}/restore/#{ChatMessage.unscoped.last.id}.json"
      expect(response.status).to eq(403)
    end

    it "doesn't allow restoration of posts on archived topics" do
      sign_in(user)
      topic.update(archived: true)

      put "/chat/#{chat_channel.id}/restore/#{ChatMessage.unscoped.last.id}.json"
      expect(response.status).to eq(403)
    end

    it "allows a user to restore their own posts" do
      sign_in(user)

      deleted_message = ChatMessage.unscoped.last
      put "/chat/#{chat_channel.id}/restore/#{deleted_message.id}.json"
      expect(response.status).to eq(200)
      expect(deleted_message.reload.deleted_at).to eq(nil)
    end

    it "allows admin to restore others' posts" do
      sign_in(admin)

      deleted_message = ChatMessage.unscoped.last
      put "/chat/#{chat_channel.id}/restore/#{deleted_message.id}.json"
      expect(response.status).to eq(200)
      expect(deleted_message.reload.deleted_at).to eq(nil)
    end
  end
end
