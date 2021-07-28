# frozen_string_literal: true

require 'rails_helper'
require_relative '../fabricators/chat_channel_fabricator'

RSpec.describe DiscourseChat::ChatController do
  fab!(:user) { Fabricate(:user) }
  fab!(:admin) { Fabricate(:admin) }
  fab!(:category) { Fabricate(:category) }
  fab!(:topic) { Fabricate(:topic, category: category) }

  before do
    SiteSetting.topic_chat_enabled = true
    SiteSetting.topic_chat_restrict_to_staff = false # Change this per-test to false if needed
  end

  describe "#enable_chat" do
    it "errors for non-staff" do
      sign_in(user)
      Fabricate(:chat_channel, chatable: topic)
      post "/chat/enable.json", params: { chatable_type: "topic", chatable_id: topic.id }
      expect(response.status).to eq(403)

      expect(topic.reload.custom_fields[DiscourseChat::HAS_CHAT_ENABLED]).to eq(nil)
    end

    it "Returns a 422 when chat is already enabled" do
      sign_in(admin)
      Fabricate(:chat_channel, chatable: topic)
      post "/chat/enable.json", params: { chatable_type: "topic", chatable_id: topic.id }
      expect(response.status).to eq(422)

      expect(topic.reload.custom_fields[DiscourseChat::HAS_CHAT_ENABLED]).to eq(nil)
    end

    it "Enables chat" do
      sign_in(admin)
      post "/chat/enable.json", params: { chatable_type: "topic", chatable_id: topic.id }
      expect(response.status).to eq(200)
      expect(topic.chat_channel).to be_present

      expect(topic.reload.custom_fields[DiscourseChat::HAS_CHAT_ENABLED]).to eq(true)
    end
  end

  describe "#disable_chat" do
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

      topic.custom_fields[DiscourseChat::HAS_CHAT_ENABLED] = true
      topic.save!

      post "/chat/disable.json", params: { chatable_type: "topic", chatable_id: topic.id }
      expect(response.status).to eq(200)
      expect(chat_channel.reload.deleted_by_id).to eq(admin.id)
      expect(topic.reload.custom_fields[DiscourseChat::HAS_CHAT_ENABLED]).to eq(nil)
    end
  end

  describe "#create_message" do
    let(:message) { "This is a message" }

    describe "for topic" do
      fab!(:chat_channel) { Fabricate(:chat_channel, chatable: topic) }

      it "errors for regular user when chat is staff-only" do
        sign_in(user)
        SiteSetting.topic_chat_restrict_to_staff = true

        post "/chat/#{chat_channel.id}.json", params: { message: message }
        expect(response.status).to eq(403)
      end

      it "sends a message for regular user when staff-only is false" do
        sign_in(user)

        expect {
          post "/chat/#{chat_channel.id}.json", params: { message: message }
        }.to change { ChatMessage.count }.by(1)
        expect(response.status).to eq(200)
        expect(ChatMessage.last.message).to eq(message)
      end
    end

    describe "for site chat" do
      fab!(:chat_channel) { Fabricate(:site_chat_channel) }

      it "errors for regular user" do
        sign_in(user)
        SiteSetting.topic_chat_restrict_to_staff = false

        post "/chat/#{chat_channel.id}.json", params: { message: message }
        expect(response.status).to eq(403)
      end

      it "sends a message for staff" do
        sign_in(admin)

        expect {
          post "/chat/#{chat_channel.id}.json", params: { message: message }
        }.to change { ChatMessage.count }.by(1)
        expect(response.status).to eq(200)
        expect(ChatMessage.last.message).to eq(message)
      end
    end
  end

  describe "#edit_message" do
    fab!(:chat_channel) { Fabricate(:site_chat_channel) }
    fab!(:chat_message) { Fabricate(:chat_message, chat_channel: chat_channel, user: user) }

    it "errors when a user tries to edit another user's message" do
      sign_in(Fabricate(:user))

      put "/chat/#{chat_channel.id}/edit/#{chat_message.id}.json", params: { new_message: "edit!" }
      expect(response.status).to eq(403)
    end

    it "allows a user to edit their own messages" do
      sign_in(user)
      new_message = "Wow markvanlan must be a good programmer"

      put "/chat/#{chat_channel.id}/edit/#{chat_message.id}.json", params: { new_message: new_message }
      expect(response.status).to eq(200)
      expect(chat_message.reload.message).to eq(new_message)
    end

    it "allows staff to edit others' messages" do
      sign_in(admin)
      new_message = "Vrroooom cars go fast"

      put "/chat/#{chat_channel.id}/edit/#{chat_message.id}.json", params: { new_message: new_message }
      expect(response.status).to eq(200)
      expect(chat_message.reload.message).to eq(new_message)
    end
  end

  RSpec.shared_examples "chat_message_deletion" do
    it "doesn't allow a user to delete another user's message" do
      sign_in(other_user)

      delete "/chat/#{chat_channel.id}/#{ChatMessage.last.id}.json"
      expect(response.status).to eq(403)
    end

    it "Allows admin to delete others' messages" do
      sign_in(admin)

      expect {
        delete "/chat/#{chat_channel.id}/#{ChatMessage.last.id}.json"
      }.to change { ChatMessage.count }.by(-1)
      expect(response.status).to eq(200)
    end
  end

  describe "#delete" do
    fab!(:second_user) { Fabricate(:user) }

    before do
      ChatMessage.create(user: user, message: "this is a message", chat_channel: chat_channel)
    end

    describe "for topic" do
      fab!(:chat_channel) { Fabricate(:chat_channel, chatable: topic) }

      it_behaves_like "chat_message_deletion" do
        let(:other_user) { second_user }
      end

      it "Allows users to delete their own messages" do
        sign_in(user)
        expect {
          delete "/chat/#{chat_channel.id}/#{ChatMessage.last.id}.json"
        }.to change { ChatMessage.count }.by(-1)
        expect(response.status).to eq(200)
      end
    end

    describe "for category" do
      fab!(:chat_channel) { Fabricate(:chat_channel, chatable: category) }

      it_behaves_like "chat_message_deletion" do
        let(:other_user) { second_user }
      end

      it "Allows users to delete their own messages" do
        sign_in(user)
        expect {
          delete "/chat/#{chat_channel.id}/#{ChatMessage.last.id}.json"
        }.to change { ChatMessage.count }.by(-1)
        expect(response.status).to eq(200)
      end
    end

    describe "for site" do
      fab!(:chat_channel) { Fabricate(:site_chat_channel) }

      it_behaves_like "chat_message_deletion" do
        let(:other_user) { second_user }
      end

      it "Doesn't allows regular users to delete their own messages" do
        sign_in(user)

        delete "/chat/#{chat_channel.id}/#{ChatMessage.last.id}.json"
        expect(response.status).to eq(403)
      end
    end
  end

  RSpec.shared_examples "chat_message_restoration" do
    it "doesn't allow a user to restore another user's message" do
      sign_in(other_user)

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

  describe "#restore" do
    fab!(:second_user) { Fabricate(:user) }

    before do
      message = ChatMessage.create(user: user, message: "this is a message", chat_channel: chat_channel)
      message.update(deleted_at: Time.now, deleted_by_id: user.id)
    end

    describe "for topic" do
      fab!(:chat_channel) { Fabricate(:chat_channel, chatable: topic) }

      it_behaves_like "chat_message_restoration" do
        let(:other_user) { second_user }
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
    end

    describe "for category" do
      fab!(:chat_channel) { Fabricate(:chat_channel, chatable: category) }

      it_behaves_like "chat_message_restoration" do
        let(:other_user) { second_user }
      end
    end

    describe "for site" do
      fab!(:chat_channel) { Fabricate(:site_chat_channel) }

      it "doesn't allow regular users to restore their own posts" do
        sign_in(user)

        deleted_message = ChatMessage.unscoped.last
        put "/chat/#{chat_channel.id}/restore/#{deleted_message.id}.json"
        expect(response.status).to eq(403)
      end

      it "allows admin to restore their own" do
        admin_message = ChatMessage.create(user: admin, message: "this is a message", chat_channel: chat_channel)
        admin_message.update(deleted_at: Time.now, deleted_by_id: user.id)
        sign_in(admin)

        put "/chat/#{chat_channel.id}/restore/#{admin_message.id}.json"
        expect(response.status).to eq(200)
        expect(admin_message.reload.deleted_at).to eq(nil)
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

  describe "#index" do
    fab!(:private_group) { Fabricate(:group) }
    fab!(:user_with_private_access) { Fabricate(:user, group_ids: [private_group.id]) }

    fab!(:public_category_cc) { Fabricate(:chat_channel, chatable: category) }
    fab!(:public_topic_cc) { Fabricate(:chat_channel, chatable: topic) }

    fab!(:private_category) { Fabricate(:private_category, group: private_group) }
    fab!(:private_category_cc) { Fabricate(:chat_channel, chatable: private_category) }

    fab!(:private_topic) { Fabricate(:topic, category: private_category) }
    fab!(:private_topic_cc) { Fabricate(:chat_channel, chatable: private_topic) }

    fab!(:one_off_topic) { Fabricate(:topic) }
    fab!(:one_off_cc) { Fabricate(:chat_channel, chatable: one_off_topic) }

    # Create closed/archived topic chat channels. These will never be returned to anyone.
    fab!(:closed_topic) { Fabricate(:closed_topic) }
    fab!(:closed_topic_channel) { Fabricate(:chat_channel, chatable: closed_topic) }
    fab!(:archived_topic) { Fabricate(:closed_topic) }
    fab!(:archived_topic_channel) { Fabricate(:chat_channel, chatable: archived_topic) }

    it "errors for regular user when chat is staff-only" do
      sign_in(user)
      SiteSetting.topic_chat_restrict_to_staff = true

      get "/chat/index.json"

      expect(response.status).to eq(403)
    end

    it "returns public channels to only-public user" do
      sign_in(user)
      get "/chat/index.json"

      expect(response.status).to eq(200)
      expect(response.parsed_body.map { |channel| channel["chatable_id"] })
        .to match_array([public_category_cc.chatable_id, one_off_cc.chatable_id])

      expect(response.parsed_body.detect { |channel| channel["id"] == public_category_cc.id }["chat_channels"].first["chatable_id"]).to eq(public_topic_cc.chatable_id)
    end

    it "returns channels visible to user with private access" do
      sign_in(user_with_private_access)
      get "/chat/index.json"

      expect(response.status).to eq(200)
      expect(response.parsed_body.map { |channel| channel["chatable_id"] })
        .to match_array([
          public_category_cc.chatable_id,
          one_off_cc.chatable_id,
          private_category_cc.chatable_id
        ])

      expect(response.parsed_body.detect { |channel| channel["id"] == public_category_cc.id }["chat_channels"].first["chatable_id"]).to eq(public_topic_cc.chatable_id)
      expect(response.parsed_body.detect { |channel| channel["id"] == private_category_cc.id }["chat_channels"].first["chatable_id"]).to eq(private_topic_cc.chatable_id)
    end

    it "returns all channels for admin, including site chat" do
      sign_in(admin)
      get "/chat/index.json"

      expect(response.status).to eq(200)
      expect(response.parsed_body.map { |channel| channel["chatable_id"] })
        .to match_array([
          DiscourseChat::SITE_CHAT_ID,
          public_category_cc.chatable_id,
          private_category_cc.chatable_id,
          one_off_cc.chatable_id
        ])

      expect(response.parsed_body.detect { |channel| channel["id"] == public_category_cc.id }["chat_channels"].first["chatable_id"]).to eq(public_topic_cc.chatable_id)

      expect(response.parsed_body.detect { |channel| channel["id"] == private_category_cc.id }["chat_channels"].first["chatable_id"]).to eq(private_topic_cc.chatable_id)
    end
  end
end
