# frozen_string_literal: true

require 'rails_helper'

RSpec.describe DiscourseChat::MoveToTopicController do
  describe "#create" do
    fab!(:admin) { Fabricate(:admin) }
    fab!(:user) { Fabricate(:user) }
    fab!(:other_user) { Fabricate(:user) }
    fab!(:category) { Fabricate(:category) }
    fab!(:topic) { Fabricate(:topic, category: category) }
    fab!(:chat_channel) { Fabricate(:chat_channel, chatable: topic) }

    fab!(:image_1) { Fabricate(:image_upload) }
    fab!(:image_2) { Fabricate(:image_upload) }

    fab!(:user_message_1) { Fabricate(:chat_message, chat_channel: chat_channel, user: user) }
    fab!(:user_message_2) { Fabricate(:chat_message, chat_channel: chat_channel, user: user) }
    fab!(:other_user_message_1) { Fabricate(:chat_message, chat_channel: chat_channel, user: other_user) }
    fab!(:other_user_message_2) { Fabricate(:chat_message, chat_channel: chat_channel, user: other_user) }
    fab!(:admin_message_1) { Fabricate(:chat_message, chat_channel: chat_channel, user: admin) }

    before do
      sign_in(admin)
      SiteSetting.chat_enabled = true
      SiteSetting.chat_allowed_groups = Group::AUTO_GROUPS[:everyone]
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

    it "errors for regular user" do
      sign_in(user)

      post "/chat/move_to_topic.json",
        params: build_params(
          5,
          {
            type: "existingTopic",
            topic_id: topic.id
          })
      expect(response.status).to eq(403)
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

      user_message_1.uploads << [image_1, image_2]
      admin_message_1.uploads << image_2
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

      # Check images
      expect(topic.ordered_posts.first.raw).to include(image_1.short_url)
      expect(topic.ordered_posts.first.raw).to include(image_2.short_url)
      expect(topic.ordered_posts.third.raw).to include(image_2.short_url)
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
