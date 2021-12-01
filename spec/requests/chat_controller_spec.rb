# frozen_string_literal: true

require 'rails_helper'
require_relative '../fabricators/chat_fabricator'

RSpec.describe DiscourseChat::ChatController do
  fab!(:user) { Fabricate(:user) }
  fab!(:admin) { Fabricate(:admin) }
  fab!(:category) { Fabricate(:category) }
  fab!(:topic) { Fabricate(:topic, category: category) }
  fab!(:tag) { Fabricate(:tag) }

  before do
    SiteSetting.chat_enabled = true
    SiteSetting.chat_allowed_groups = Group::AUTO_GROUPS[:everyone]
  end

  describe "#messages" do
    fab!(:chat_channel) { Fabricate(:chat_channel, chatable: topic) }
    let(:page_size) { 30 }
    let(:message_count) { 35 }

    before do
      message_count.times do |n|
        ChatMessage.create(
          chat_channel: chat_channel,
          user: user,
          message: "message #{n}",
        )
      end
      sign_in(user)
    end

    it "errors for user when they are not allowed to chat" do
      SiteSetting.chat_allowed_groups = Group::AUTO_GROUPS[:staff]
      get "/chat/#{chat_channel.id}/messages.json", params: { page_size: page_size }
      expect(response.status).to eq(403)
    end

    it "errors when page size is over 50" do
      get "/chat/#{chat_channel.id}/messages.json", params: { page_size: 51 }
      expect(response.status).to eq(400)
    end

    it "errors when page size is nil" do
      get "/chat/#{chat_channel.id}/messages.json"
      expect(response.status).to eq(400)
    end

    it "returns the latest messages" do
      get "/chat/#{chat_channel.id}/messages.json", params: { page_size: page_size }
      messages = response.parsed_body["chat_view"]["messages"]
      expect(messages.count).to eq(page_size)
      expect(messages.first["id"]).to be < messages.last["id"]
    end

    it "returns messages before `before_message_id` if present" do
      before_message_id = ChatMessage
        .order(created_at: :desc)
        .to_a[page_size - 1]
        .id

      get "/chat/#{chat_channel.id}/messages.json", params: { before_message_id: before_message_id, page_size: page_size }
      messages = response.parsed_body["chat_view"]["messages"]
      expect(messages.count).to eq(message_count - page_size)
    end
  end

  describe "#enable_chat" do
    describe "for topic" do
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

      it "Enables chat and follows the channel" do
        sign_in(admin)
        expect {
          post "/chat/enable.json", params: { chatable_type: "topic", chatable_id: topic.id }
        }.to change {
          admin.user_chat_channel_memberships.count
        }.by(1)
        expect(response.status).to eq(200)
        expect(topic.chat_channel).to be_present
        expect(topic.reload.custom_fields[DiscourseChat::HAS_CHAT_ENABLED]).to eq(true)
      end
    end

    describe "for tag" do
      it "enables chat" do
        sign_in(admin)
        post "/chat/enable.json", params: { chatable_type: "tag", chatable_id: tag.id }
        expect(response.status).to eq(200)
        expect(ChatChannel.where(chatable: tag)).to be_present
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

      it "Returns a 200 and does nothing when chat is already disabled" do
        sign_in(admin)
        chat_channel = Fabricate(:chat_channel, chatable: topic)
        chat_channel.update(deleted_at: Time.now, deleted_by_id: admin.id)

        post "/chat/disable.json", params: { chatable_type: "topic", chatable_id: topic.id }
        expect(response.status).to eq(200)
        expect(chat_channel.reload.deleted_at).not_to be_nil
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

    describe "for tag" do
      it "disables chat" do
        sign_in(admin)
        chat_channel = Fabricate(:chat_channel, chatable: tag)
        post "/chat/disable.json", params: { chatable_type: "tag", chatable_id: tag.id }
        expect(response.status).to eq(200)
        expect(chat_channel.reload.deleted_by_id).to eq(admin.id)
      end
    end
  end

  describe "#create_message" do
    let(:message) { "This is a message" }

    describe "for topic" do
      fab!(:chat_channel) { Fabricate(:chat_channel, chatable: topic) }

      it "errors for regular user when chat is staff-only" do
        sign_in(user)
        SiteSetting.chat_allowed_groups = Group::AUTO_GROUPS[:staff]

        post "/chat/#{chat_channel.id}.json", params: { message: message }
        expect(response.status).to eq(403)
      end

      it "errors when the user isn't following the channel" do
        sign_in(user)

        post "/chat/#{chat_channel.id}.json", params: { message: message }
        expect(response.status).to eq(403)
      end

      it "sends a message for regular user when staff-only is disabled and they are following channel" do
        sign_in(user)
        UserChatChannelMembership.create(user: user, chat_channel: chat_channel, following: true)

        expect {
          post "/chat/#{chat_channel.id}.json", params: { message: message }
        }.to change { ChatMessage.count }.by(1)
        expect(response.status).to eq(200)
        expect(ChatMessage.last.message).to eq(message)
      end
    end
  end

  describe "#edit_message" do
    fab!(:chat_channel) { Fabricate(:chat_channel) }
    fab!(:chat_message) { Fabricate(:chat_message, chat_channel: chat_channel, user: user) }

    it "errors when a user tries to edit another user's message" do
      sign_in(Fabricate(:user))

      put "/chat/#{chat_channel.id}/edit/#{chat_message.id}.json", params: { new_message: "edit!" }
      expect(response.status).to eq(403)
    end

    it "errors when staff tries to edit another user's message" do
      sign_in(admin)
      new_message = "Vrroooom cars go fast"

      put "/chat/#{chat_channel.id}/edit/#{chat_message.id}.json", params: { new_message: new_message }
      expect(response.status).to eq(403)
    end

    it "allows a user to edit their own messages" do
      sign_in(user)
      new_message = "Wow markvanlan must be a good programmer"

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
  end

  describe "#update_user_last_read" do
    fab!(:chat_channel) { Fabricate(:chat_channel, chatable: topic) }
    fab!(:chat_message) { Fabricate(:chat_message, chat_channel: chat_channel, user: user) }

    before { sign_in(user) }

    it "updates timing records" do
      existing_record = UserChatChannelMembership.create(
        chat_channel: chat_channel,
        last_read_message_id: 0,
        user: user
      )

      expect {
        put "/chat/#{chat_channel.id}/read/#{chat_message.id}.json"
      }.to change { UserChatChannelMembership.count }.by(0)
      existing_record.reload
      expect(existing_record.chat_channel_id).to eq(chat_channel.id)
      expect(existing_record.last_read_message_id).to eq(chat_message.id)
      expect(existing_record.user_id).to eq(user.id)
    end
  end

  describe "#move_to_topic" do
    fab!(:other_user) { Fabricate(:user) }
    fab!(:chat_channel) { Fabricate(:chat_channel, chatable: topic) }

    fab!(:user_message_1) { Fabricate(:chat_message, chat_channel: chat_channel, user: user) }
    fab!(:user_message_2) { Fabricate(:chat_message, chat_channel: chat_channel, user: user) }
    fab!(:other_user_message_1) { Fabricate(:chat_message, chat_channel: chat_channel, user: other_user) }
    fab!(:other_user_message_2) { Fabricate(:chat_message, chat_channel: chat_channel, user: other_user) }
    fab!(:admin_message_1) { Fabricate(:chat_message, chat_channel: chat_channel, user: admin) }

    before do
      sign_in(user)
      SiteSetting.min_trust_to_create_tag = 0
      SiteSetting.min_trust_level_to_tag_topics = 0
    end

    def build_params(number_of_messages, opts)
      all_messages = [user_message_1, user_message_2, other_user_message_1, other_user_message_2, admin_message_1]

      {
        chat_message_ids: all_messages[0..number_of_messages].map(&:id),
        chat_channel_id: chat_channel.id,
      }.merge(opts)
    end

    it "errors when type param is invalid" do
      post "/chat/move_to_topic.json", params: build_params(5, { type: "invalid", topic_id: topic.id })
      expect(response.parsed_body["errors"].first).to include("Invalid type")
      expect(response.status).to eq(400)
    end

    it "errors when chat_message_ids are empty" do
      post "/chat/move_to_topic.json", params: build_params(5, { type: "existingTopic", topic_id: topic.id, chat_message_ids: [] })
      expect(response.status).to eq(400)
      expect(response.parsed_body["errors"].first).to include("Must include at least one chat message id")
    end

    it "errors when the topic title is invalid" do
      SiteSetting.min_topic_title_length = 15
      topic_title = "title 2 short"
      post "/chat/move_to_topic.json",
        params: build_params(
          5,
          {
            type: "newTopic",
            title: topic_title,
            category_id: category.id,
          })
      expect(response.status).to eq(400)
      expect(response.parsed_body["errors"].first).to include("title is too short")
    end

    it "creates a new topic with the correct properties" do
      topic_title = "This is a new topic that is created via chat!"
      tag_names = ["ctag1", "ctag2"]
      expect {
        post "/chat/move_to_topic.json",
          params: build_params(
            5,
            {
              type: "newTopic",
              title: topic_title,
              category_id: category.id,
              tags: tag_names
            })
      }
        .to change { ChatMessagePostConnection.count }.by(5)
        .and change { Topic.count }.by(1)
        .and change { Post.count }.by(3) # Only 3 because subsequent chat messages by a user are grouped

      expect(response.status).to eq(200)
      topic = Topic.find_by(id: response.parsed_body["id"])
      expect(topic.title).to eq(topic_title)
      expect(topic.category).to eq(category)
      expect(topic.tags.map(&:name)).to eq(tag_names)

      expect(topic.ordered_posts.first.user).to eq(user)
      expect(topic.ordered_posts.second.user).to eq(other_user)
      expect(topic.ordered_posts.third.user).to eq(admin)
    end

    it "creates posts for existing topics" do
      topic_title = "This is a new topic that is created via chat!"
      tag_names = ["ctag1", "ctag2"]
      expect {
        post "/chat/move_to_topic.json",
          params: build_params(
            5,
            {
              type: "existingTopic",
              topic_id: topic.id
            })
      }
        .to change { ChatMessagePostConnection.count }.by(5)
        .and change { Topic.count }.by(0)
        .and change { Post.where(topic_id: topic.id).count }.by(3)
    end

    it "creates a new private message properly" do
      topic_title = "This is a new private message that is created via chat!"
      expect {
        post "/chat/move_to_topic.json",
          params: build_params(
            5,
            {
              type: "newMessage",
              title: topic_title
            })
      }
        .to change { ChatMessagePostConnection.count }.by(5)
        .and change { Topic.private_messages.count }.by(1)
        .and change { Post.count }.by(3)

      expect(response.status).to eq(200)
      topic = Topic.find_by(id: response.parsed_body["id"])
      expect(topic.title).to eq(topic_title)
      expect(topic.archetype).to eq(Archetype.private_message)
      expect(topic.topic_users.map(&:user_id)).to match_array([user.id, other_user.id, admin.id])
    end
  end
end
