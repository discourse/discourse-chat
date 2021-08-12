# frozen_string_literal: true

require 'rails_helper'
require_relative '../fabricators/chat_fabricator'

RSpec.describe DiscourseChat::DirectMessagesController do
  fab!(:user) { Fabricate(:user) }
  fab!(:user1) { Fabricate(:user) }
  fab!(:user2) { Fabricate(:user) }
  fab!(:user3) { Fabricate(:user) }
  before do
    SiteSetting.topic_chat_enabled = true
    SiteSetting.topic_chat_restrict_to_staff = false # Change this per-test to false if needed
    sign_in(user)
  end

  def create_dm_channel(user_ids)
    direct_messages_channel = DirectMessageChannel.create!
    user_ids.each do |user_id|
      direct_messages_channel.direct_message_users.create!(user_id: user_id)
    end
    chat_channel = ChatChannel.create!(chatable: direct_messages_channel)
  end

  describe "#create" do
    it "creates a new dm channel with one username provided" do
      expect {
        post "/chat/direct_messages/create.json", params: { usernames: user1.username }
      }.to change { DirectMessageChannel.count }.by(1)
      expect(DirectMessageChannel.last.direct_message_users.map(&:user_id))
        .to match_array([user.id, user1.id])
    end

    it "returns existing dm channel if one exists for 2 users" do
      create_dm_channel([user.id, user1.id])
      expect {
        post "/chat/direct_messages/create.json", params: { usernames: user1.username }
      }.to change { DirectMessageChannel.count }.by(0)
    end

    it "creates a new dm channel with multiple username provided" do
      usernames = [user1, user2, user3].map(&:username).join(",")
      expect {
        post "/chat/direct_messages/create.json", params: { usernames: usernames }
      }.to change { DirectMessageChannel.count }.by(1)
      expect(DirectMessageChannel.last.direct_message_users.map(&:user_id))
        .to match_array([user.id, user1.id, user2.id, user3.id])
    end

    it "returns existing dm channel if one exists for multiple users" do
      users = [user, user1, user2, user3]
      create_dm_channel(users.map(&:id))
      usernames = users.map(&:username).join(",")
      expect {
        post "/chat/direct_messages/create.json", params: { usernames: usernames }
      }.to change { DirectMessageChannel.count }.by(0)
    end
  end
end
