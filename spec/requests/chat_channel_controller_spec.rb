# frozen_string_literal: true

require 'rails_helper'
require_relative '../fabricators/chat_fabricator'

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
        expect(response.parsed_body["public_channels"].map { |channel| channel["chatable_id"] })
          .to match_array([public_category_cc.chatable_id, one_off_cc.chatable_id, tag_channel.chatable_id])

        expect(response.parsed_body["public_channels"].detect { |channel| channel["id"] == public_category_cc.id }["chat_channels"].first["chatable_id"]).to eq(public_topic_cc.chatable_id)
      end

      it "returns channels visible to user with private access" do
        sign_in(user_with_private_access)
        get "/chat/chat_channels.json"

        expect(response.status).to eq(200)
        expect(response.parsed_body["public_channels"].map { |channel| channel["chatable_id"] })
          .to match_array([
            public_category_cc.chatable_id,
            one_off_cc.chatable_id,
            private_category_cc.chatable_id,
            tag_channel.chatable_id
          ])

        expect(response.parsed_body["public_channels"].detect { |channel| channel["id"] == public_category_cc.id }["chat_channels"].first["chatable_id"]).to eq(public_topic_cc.chatable_id)
        expect(response.parsed_body["public_channels"].detect { |channel| channel["id"] == private_category_cc.id }["chat_channels"].first["chatable_id"]).to eq(private_topic_cc.chatable_id)
      end

      it "returns all channels for admin" do
        sign_in(admin)
        get "/chat/chat_channels.json"

        expect(response.status).to eq(200)
        expect(response.parsed_body["public_channels"].map { |channel| channel["chatable_id"] })
          .to match_array([
            public_category_cc.chatable_id,
            private_category_cc.chatable_id,
            one_off_cc.chatable_id,
            tag_channel.chatable_id,
            staff_tag_channel.chatable_id
          ])

        expect(response.parsed_body["public_channels"].detect { |channel| channel["id"] == public_category_cc.id }["chat_channels"].first["chatable_id"]).to eq(public_topic_cc.chatable_id)

        expect(response.parsed_body["public_channels"].detect { |channel| channel["id"] == private_category_cc.id }["chat_channels"].first["chatable_id"]).to eq(private_topic_cc.chatable_id)
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

  describe "#for_tag" do
    fab!(:tag_with_channel) { Fabricate(:tag) }
    fab!(:tag_without_channel) { Fabricate(:tag) }
    fab!(:tag_channel) { Fabricate(:chat_channel, chatable: tag_with_channel) }

    it "errors for anon" do
      get "/chat/chat_channels/for_tag/#{tag_with_channel.name}.json"
      expect(response.status).to eq(403)
    end

    it "returns the tag's chat channel" do
      sign_in(user)
      get "/chat/chat_channels/for_tag/#{tag_with_channel.name}.json"
      expect(response.status).to eq(200)
      expect(response.parsed_body["chat_channel"]["id"]).to eq(tag_channel.id)
    end

    it "returns nil if a chat channel doesn't exist for tag" do
      sign_in(user)
      get "/chat/chat_channels/for_tag/#{tag_without_channel.name}.json"
      expect(response.status).to eq(200)
      expect(response.parsed_body["chat_channel"]).to eq(nil)
    end
  end

  describe "#for_category" do
    fab!(:category_without_channel) { Fabricate(:category) }
    fab!(:category_channel) { Fabricate(:chat_channel, chatable: category) }

    fab!(:private_category) { Fabricate(:private_category, group: Fabricate(:group)) }
    fab!(:private_category_channel) { Fabricate(:chat_channel, chatable: private_category) }

    it "errors for anon" do
      get "/chat/chat_channels/for_category/#{category.id}.json"
      expect(response.status).to eq(403)
    end

    it "returns the categories's chat channel" do
      sign_in(user)
      get "/chat/chat_channels/for_category/#{category.id}.json"
      expect(response.status).to eq(200)
      expect(response.parsed_body["chat_channel"]["id"]).to eq(category_channel.id)
    end

    it "errors when user trys to access staff channel" do
      sign_in(user)
      get "/chat/chat_channels/for_category/#{private_category.id}.json"
      expect(response.status).to eq(403)
    end

    it "returns private channel for admin" do
      sign_in(admin)
      get "/chat/chat_channels/for_category/#{private_category.id}.json"
      expect(response.status).to eq(200)
      expect(response.parsed_body["chat_channel"]["id"]).to eq(private_category_channel.id)
    end

    it "returns nil if a chat channel doesn't exist for category" do
      sign_in(user)
      get "/chat/chat_channels/for_category/#{category_without_channel.id}.json"
      expect(response.status).to eq(200)
      expect(response.parsed_body["chat_channel"]).to eq(nil)
    end
  end
end
