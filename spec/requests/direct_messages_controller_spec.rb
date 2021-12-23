# frozen_string_literal: true

require 'rails_helper'

RSpec.describe DiscourseChat::DirectMessagesController do
  fab!(:user) { Fabricate(:user) }
  fab!(:user1) { Fabricate(:user) }
  fab!(:user2) { Fabricate(:user) }
  fab!(:user3) { Fabricate(:user) }

  before do
    SiteSetting.chat_enabled = true
    SiteSetting.chat_allowed_groups = Group::AUTO_GROUPS[:everyone]
    sign_in(user)
  end

  def create_dm_channel(user_ids)
    direct_messages_channel = DirectMessageChannel.create!
    user_ids.each do |user_id|
      direct_messages_channel.direct_message_users.create!(user_id: user_id)
    end
    ChatChannel.create!(chatable: direct_messages_channel)
  end

  describe "#create" do
    shared_examples "creating dms" do
      it "creates a new dm channel with username(s) provided" do
        expect {
          post "/chat/direct_messages/create.json", params: { usernames: usernames }
        }.to change { DirectMessageChannel.count }.by(1)
        expect(DirectMessageChannel.last.direct_message_users.map(&:user_id))
          .to match_array(direct_message_user_ids)
      end

      it "returns existing dm channel if one exists for username(s)" do
        create_dm_channel(direct_message_user_ids)
        expect {
          post "/chat/direct_messages/create.json", params: { usernames: usernames }
        }.to change { DirectMessageChannel.count }.by(0)
      end
    end

    describe "dm with one other user" do
      let(:usernames) { user1.username }
      let(:direct_message_user_ids) { [user.id, user1.id] }

      include_examples "creating dms"
    end

    describe "dm with myself" do
      let(:usernames) { user.username }
      let(:direct_message_user_ids) { [user.id] }

      include_examples "creating dms"
    end

    describe "dm with two other users" do
      let(:usernames) { [user1, user2, user3].map(&:username).join(",") }
      let(:direct_message_user_ids) { [user.id, user1.id, user2.id, user3.id] }

      include_examples "creating dms"
    end

    it "creates UserChatChannelMembership records" do
      users = [user2, user3]
      usernames = users.map(&:username).join(",")
      expect {
        post "/chat/direct_messages/create.json", params: { usernames: usernames }
      }.to change { UserChatChannelMembership.count }.by(3)
    end
  end
end
