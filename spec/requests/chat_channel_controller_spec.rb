# frozen_string_literal: true

require 'rails_helper'

RSpec.describe DiscourseChat::ChatChannelsController do
  fab!(:user) { Fabricate(:user) }
  fab!(:admin) { Fabricate(:admin) }
  fab!(:category) { Fabricate(:category) }
  fab!(:topic) { Fabricate(:topic, category: category) }
  fab!(:chat_channel) { Fabricate(:chat_channel, chatable: topic) }
  fab!(:dm_chat_channel) { Fabricate(:chat_channel, chatable: Fabricate(:direct_message_channel, users: [user, admin])) }
  fab!(:tag_channel) { Fabricate(:chat_channel, chatable: Fabricate(:tag)) }

  fab!(:staff_tag) { Fabricate(:tag) }
  let!(:staff_tag_group) { Fabricate(:tag_group, permissions: { "staff" => 1 }, tag_names: [staff_tag.name]) }
  fab!(:staff_tag_channel) { Fabricate(:chat_channel, chatable: staff_tag) }

  before do
    SiteSetting.chat_enabled = true
    SiteSetting.chat_allowed_groups = Group::AUTO_GROUPS[:everyone]
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

    describe "with memberships for all channels" do
      before do
        ChatChannel.all.each do |cc|
          model = cc.direct_message_channel? ?
            :user_chat_channel_membership_for_dm :
            :user_chat_channel_membership

          Fabricate(model, chat_channel: cc, user: user)
          Fabricate(model, chat_channel: cc, user: user_with_private_access)
          Fabricate(model, chat_channel: cc, user: admin)
        end
      end

      it "errors for user that is not allowed to chat" do
        sign_in(user)
        SiteSetting.chat_allowed_groups = Group::AUTO_GROUPS[:staff]

        get "/chat/chat_channels.json"

        expect(response.status).to eq(403)
      end

      it "returns public channels to only-public user" do
        sign_in(user)
        get "/chat/chat_channels.json"

        expect(response.status).to eq(200)
        expect(response.parsed_body["public_channels"].map { |channel| channel["id"] })
          .to match_array([public_category_cc.id, public_topic_cc.id, one_off_cc.id, tag_channel.id, chat_channel.id])
      end

      it "returns channels visible to user with private access" do
        sign_in(user_with_private_access)
        get "/chat/chat_channels.json"

        expect(response.status).to eq(200)
        expect(response.parsed_body["public_channels"].map { |channel| channel["id"] })
          .to match_array([
            public_category_cc.id,
            public_topic_cc.id,
            one_off_cc.id,
            tag_channel.id,
            chat_channel.id,
            private_category_cc.id,
            private_topic_cc.id
          ])
      end

      it "returns all channels for admin" do
        sign_in(admin)
        get "/chat/chat_channels.json"

        expect(response.status).to eq(200)
        expect(response.parsed_body["public_channels"].map { |channel| channel["id"] })
          .to match_array([
            public_category_cc.id,
            public_topic_cc.id,
            one_off_cc.id,
            tag_channel.id,
            chat_channel.id,
            private_category_cc.id,
            private_topic_cc.id,
            staff_tag_channel.id
          ])
      end

      it "doesn't error when a chat channel's chatable is destroyed" do
        sign_in(user_with_private_access)
        topic.destroy!
        private_category.destroy!

        get "/chat/chat_channels.json"
        expect(response.status).to eq(200)
      end

      it "serializes unread_mentions properly" do
        sign_in(admin)
        Jobs.run_immediately!
        DiscourseChat::ChatMessageCreator.create(
          chat_channel: public_category_cc,
          user: user,
          content: "Hi @#{admin.username}"
        )
          get "/chat/chat_channels.json"
          chat_channel = response.parsed_body["public_channels"].detect { |c| c["id"] == public_category_cc.id }
          expect(chat_channel["unread_mentions"]).to eq(1)
      end

      describe "direct messages" do
        fab!(:user1) { Fabricate(:user) }
        fab!(:user2) { Fabricate(:user) }
        fab!(:user3) { Fabricate(:user) }

        before do
          @dm1 = DiscourseChat::DirectMessageChannelCreator.create([user1, user2])
          @dm2 = DiscourseChat::DirectMessageChannelCreator.create([user1, user3])
          @dm3 = DiscourseChat::DirectMessageChannelCreator.create([user1, user2, user3])
          @dm4 = DiscourseChat::DirectMessageChannelCreator.create([user2, user3])
        end

        it "returns correct DMs for user1" do
          sign_in(user1)

          get "/chat/chat_channels.json"
          expect(response.parsed_body["direct_message_channels"].map { |c| c["id"] })
            .to match_array([@dm1.id, @dm2.id, @dm3.id])
        end

        it "returns correct DMs for user2" do
          sign_in(user2)

          get "/chat/chat_channels.json"
          expect(response.parsed_body["direct_message_channels"].map { |c| c["id"] })
            .to match_array([@dm1.id, @dm3.id, @dm4.id])
        end

        it "returns correct DMs for user3" do
          sign_in(user3)

          get "/chat/chat_channels.json"
          expect(response.parsed_body["direct_message_channels"].map { |c| c["id"] })
            .to match_array([@dm2.id, @dm3.id, @dm4.id])
        end

        it "correctly set unread_count for DMs" do
          sign_in(user3)
          DiscourseChat::ChatMessageCreator.create(
            chat_channel: @dm2,
            user: user1,
            content: "What's going on?!"
          )
          get "/chat/chat_channels.json"
          dm2_response = response.parsed_body["direct_message_channels"].detect { |c| c["id"] == @dm2.id }
          expect(dm2_response["unread_count"]).to eq(1)
        end
      end
    end
  end

  describe "#follow" do
    it "creates a user_chat_channel_membership record if one doesn't exist" do
      sign_in(user)
      expect {
        post "/chat/chat_channels/#{chat_channel.id}/follow.json"
      }.to change {
        UserChatChannelMembership.where(user_id: user.id, following: true).count
      }.by(1)
      expect(response.status).to eq(200)
    end

    it "updates 'following' to true for existing record" do
      sign_in(user)
      membership_record = UserChatChannelMembership.create!(
        chat_channel_id: chat_channel.id,
        user_id: user.id,
        following: false
      )

      expect {
        post "/chat/chat_channels/#{chat_channel.id}/follow.json"
      }.to change {
        membership_record.reload.following
      }.to(true).from(false)
      expect(response.status).to eq(200)
    end
  end

  describe "#unfollow" do
    it "updates 'following' to false for existing record" do
      sign_in(user)
      membership_record = UserChatChannelMembership.create!(
        chat_channel_id: chat_channel.id,
        user_id: user.id,
        following: true
      )

      expect {
        post "/chat/chat_channels/#{chat_channel.id}/unfollow.json"
      }.to change {
        membership_record.reload.following
      }.to(false).from(true)
      expect(response.status).to eq(200)
    end

    it "errors when you try to unfollow a direct_message_channel" do
      sign_in(user)
      membership_record = UserChatChannelMembership.create!(
        chat_channel_id: dm_chat_channel.id,
        user_id: user.id,
        following: true,
        desktop_notification_level: 2,
        mobile_notification_level: 2,
      )

      post "/chat/chat_channels/#{dm_chat_channel.id}/unfollow.json"
      expect(response.status).to eq(422)
      expect(membership_record.reload.following).to eq(true)
    end
  end

  describe "#notification_settings" do
    fab!(:membership) { Fabricate(:user_chat_channel_membership, user: user, chat_channel: chat_channel) }

    it "returns a 404 when the user isn't logged in" do
      post "/chat/chat_channels/#{chat_channel.id}/notification_settings.json", params: {
        muted: true,
        desktop_notification_level: "mention",
        mobile_notification_level: "mention"
      }
      expect(response.status).to eq(403)

    end

    it "requires the correct params" do
      sign_in(user)
      post "/chat/chat_channels/#{chat_channel.id}/notification_settings.json", params: {
        muted: true,
        desktop_notification_level: "mention"
      }
      expect(response.status).to eq(400)
      post "/chat/chat_channels/#{chat_channel.id}/notification_settings.json", params: {
        muted: true,
        mobile_notification_level: "mention"
      }
      expect(response.status).to eq(400)
      post "/chat/chat_channels/#{chat_channel.id}/notification_settings.json", params: {
        mobile_notification_level: "mention",
        desktop_notification_level: "mention"
      }
      expect(response.status).to eq(400)
    end

    it "saves all the correct fields" do
      sign_in(user)
      post "/chat/chat_channels/#{chat_channel.id}/notification_settings.json", params: {
        muted: true,
        desktop_notification_level: "always",
        mobile_notification_level: "never"
      }
      expect(response.status).to eq(200)
      membership = UserChatChannelMembership.find_by(user: user, chat_channel: chat_channel)
      expect(membership.muted).to eq(true)
      expect(membership.desktop_notification_level).to eq("always")
      expect(membership.mobile_notification_level).to eq("never")
    end
  end

  describe "#create" do
    fab!(:category2) { Fabricate(:category) }
    fab!(:topic2) { Fabricate(:topic) }

    it "errors for non-staff" do
      sign_in(user)
      put "/chat/chat_channels.json", params: { type: "category", id: category2.id, name: "hi" }
      expect(response.status).to eq(403)
    end

    it "errors when type is not category/topic" do
      sign_in(admin)
      put "/chat/chat_channels.json", params: { type: "beeep", id: category2.id, name: "hi" }
      expect(response.status).to eq(400)
    end

    it "errors when chatable doesn't exist" do
      sign_in(admin)
      put "/chat/chat_channels.json", params: { type: "category", id: Category.last.id + 1, name: "hi" }
      expect(response.status).to eq(404)
    end

    it "errors when the name is over SiteSetting.max_topic_title_length" do
      sign_in(admin)
      SiteSetting.max_topic_title_length = 10
      put "/chat/chat_channels.json", params: { type: "topic", id: topic2.id, name: "Hi, this is over 10 characters" }
      expect(response.status).to eq(400)
    end

    it "errors when channel for topic already exists" do
      sign_in(admin)
      ChatChannel.create!(chatable: topic2, name: "hihihi")

      put "/chat/chat_channels.json", params: { type: "topic", id: topic2.id, name: "hi" }
      expect(response.status).to eq(400)
    end

    it "creates a channel for topic that doesn't already have a channel" do
      sign_in(admin)
      expect {
        put "/chat/chat_channels.json", params: { type: "topic", id: topic2.id, name: "Different name!" }
      }.to change { ChatChannel.where(chatable: topic2).count }.by(1)
      expect(response.status).to eq(200)
    end

    it "errors when channel for category and same name already exists" do
      sign_in(admin)
      name = "beep boop hi"
      ChatChannel.create!(chatable: category2, name: name)

      put "/chat/chat_channels.json", params: { type: "category", id: category2.id, name: name }
      expect(response.status).to eq(400)
    end

    it "creates a channel for category and if name is unique" do
      sign_in(admin)
      ChatChannel.create!(chatable: category2, name: "this is a name")

      expect {
        put "/chat/chat_channels.json", params: { type: "category", id: category2.id, name: "Different name!" }
      }.to change { ChatChannel.where(chatable: category2).count }.by(1)
      expect(response.status).to eq(200)
    end

    it "creates a user_chat_channel_membership when the channel is created" do
      sign_in(admin)
      expect {
        put "/chat/chat_channels.json", params: { type: "category", id: category2.id, name: "hi hi" }
      }.to change { UserChatChannelMembership.where(user: admin).count }.by(1)
      expect(response.status).to eq(200)
    end
  end

  describe "#edit" do
    it "errors for non-staff" do
      sign_in(user)
      post "/chat/chat_channels/#{chat_channel.id}.json", params: { name: "hello" }
      expect(response.status).to eq(403)
    end

    it "returns a 404 when chat_channel doesn't exist" do
      sign_in(admin)
      chat_channel.destroy!
      post "/chat/chat_channels/#{chat_channel.id}.json", params: { name: "hello" }
      expect(response.status).to eq(404)
    end

    it "updates name correctly and leaves description alone" do
      sign_in(admin)
      new_name = "newwwwwwwww name"
      description = "this is something"
      chat_channel.update(description: description)
      post "/chat/chat_channels/#{chat_channel.id}.json", params: { name: new_name }
      expect(response.status).to eq(200)
      expect(chat_channel.reload.name).to eq(new_name)
      expect(chat_channel.description).to eq(description)
    end

    it "updates name correctly and leaves description alone" do
      sign_in(admin)
      name = "beep boop"
      new_description = "this is something"
      chat_channel.update(name: name)
      post "/chat/chat_channels/#{chat_channel.id}.json", params: { description: new_description }
      expect(response.status).to eq(200)
      expect(chat_channel.reload.name).to eq(name)
      expect(chat_channel.description).to eq(new_description)
    end

    it "updates name and description together" do
      sign_in(admin)
      new_name = "beep boop"
      new_description = "this is something"
      post "/chat/chat_channels/#{chat_channel.id}.json", params: { name: new_name, description: new_description }
      expect(response.status).to eq(200)
      expect(chat_channel.reload.name).to eq(new_name)
      expect(chat_channel.description).to eq(new_description)
    end
  end
end
