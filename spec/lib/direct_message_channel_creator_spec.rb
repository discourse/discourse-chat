# frozen_string_literal: true

require "rails_helper"

describe Chat::DirectMessageChannelCreator do
  fab!(:user_1) { Fabricate(:user) }
  fab!(:user_2) { Fabricate(:user) }
  fab!(:user_3) { Fabricate(:user) }

  before { Group.refresh_automatic_groups! }

  context "with an existing direct message channel" do
    fab!(:dm_chat_channel) do
      Fabricate(
        :chat_channel,
        chatable: Fabricate(:direct_message_channel, users: [user_1, user_2, user_3]),
      )
    end
    fab!(:own_chat_channel) do
      Fabricate(:chat_channel, chatable: Fabricate(:direct_message_channel, users: [user_1]))
    end

    it "doesn't create a new chat channel" do
      existing_channel = nil
      expect {
        existing_channel =
          subject.create!(acting_user: user_1, target_users: [user_1, user_2, user_3])
      }.not_to change { ChatChannel.count }
      expect(existing_channel).to eq(dm_chat_channel)
    end

    it "creates UserChatChannelMembership records and sets their notification levels, and only updates creator membership to following" do
      Fabricate(
        :user_chat_channel_membership,
        user: user_2,
        chat_channel: dm_chat_channel,
        following: false,
        muted: true,
        desktop_notification_level: UserChatChannelMembership::NOTIFICATION_LEVELS[:never],
        mobile_notification_level: UserChatChannelMembership::NOTIFICATION_LEVELS[:never],
      )
      Fabricate(
        :user_chat_channel_membership,
        user: user_3,
        chat_channel: dm_chat_channel,
        following: false,
        muted: true,
        desktop_notification_level: UserChatChannelMembership::NOTIFICATION_LEVELS[:never],
        mobile_notification_level: UserChatChannelMembership::NOTIFICATION_LEVELS[:never],
      )

      expect {
        subject.create!(acting_user: user_1, target_users: [user_1, user_2, user_3])
      }.to change { UserChatChannelMembership.count }.by(1)

      user_1_membership =
        UserChatChannelMembership.find_by(user_id: user_1.id, chat_channel_id: dm_chat_channel)
      expect(user_1_membership.last_read_message_id).to eq(nil)
      expect(user_1_membership.desktop_notification_level).to eq("always")
      expect(user_1_membership.mobile_notification_level).to eq("always")
      expect(user_1_membership.muted).to eq(false)
      expect(user_1_membership.following).to eq(true)

      user_2_membership =
        UserChatChannelMembership.find_by(user_id: user_2.id, chat_channel_id: dm_chat_channel)
      expect(user_2_membership.last_read_message_id).to eq(nil)
      expect(user_2_membership.desktop_notification_level).to eq("never")
      expect(user_2_membership.mobile_notification_level).to eq("never")
      expect(user_2_membership.muted).to eq(true)
      expect(user_2_membership.following).to eq(false)

      user_3_membership =
        UserChatChannelMembership.find_by(user_id: user_3.id, chat_channel_id: dm_chat_channel)
      expect(user_3_membership.last_read_message_id).to eq(nil)
      expect(user_3_membership.desktop_notification_level).to eq("never")
      expect(user_3_membership.mobile_notification_level).to eq("never")
      expect(user_3_membership.muted).to eq(true)
      expect(user_3_membership.following).to eq(false)
    end

    it "publishes the new DM channel message bus message for each user" do
      messages =
        MessageBus
          .track_publish do
            subject.create!(acting_user: user_1, target_users: [user_1, user_2, user_3])
          end
          .filter { |m| m.channel == "/chat/new-channel" }

      expect(messages.count).to eq(3)
      expect(messages.first[:data]).to be_kind_of(Hash)
      expect(messages.map { |m| m.dig(:data, :chat_channel, :id) }).to eq(
        [dm_chat_channel.id, dm_chat_channel.id, dm_chat_channel.id],
      )
    end

    it "allows a user to create a direct message to themselves, without creating a new channel" do
      existing_channel = nil
      expect {
        existing_channel = subject.create!(acting_user: user_1, target_users: [user_1])
      }.to not_change { ChatChannel.count }.and change { UserChatChannelMembership.count }.by(1)
      expect(existing_channel).to eq(own_chat_channel)
    end

    it "deduplicates target_users" do
      existing_channel = nil
      expect {
        existing_channel = subject.create!(acting_user: user_1, target_users: [user_1, user_1])
      }.to not_change { ChatChannel.count }.and change { UserChatChannelMembership.count }.by(1)
      expect(existing_channel).to eq(own_chat_channel)
    end

    context "when the user is not a member of direct_message_enabled_groups" do
      before { SiteSetting.direct_message_enabled_groups = Group::AUTO_GROUPS[:trust_level_4] }

      it "raises an error and does not change membership or channel counts" do
        channel_count = ChatChannel.count
        membership_count = UserChatChannelMembership.count
        expect {
          existing_channel = subject.create!(acting_user: user_1, target_users: [user_1, user_1])
        }.to raise_error(Discourse::InvalidAccess)
        expect(ChatChannel.count).to eq(channel_count)
        expect(UserChatChannelMembership.count).to eq(membership_count)
      end

      context "when user is staff" do
        before { user_1.update!(admin: true) }

        it "doesn't create an error and returns the existing channel" do
          existing_channel = nil
          expect {
            existing_channel =
              subject.create!(acting_user: user_1, target_users: [user_1, user_2, user_3])
          }.not_to change { ChatChannel.count }
          expect(existing_channel).to eq(dm_chat_channel)
        end
      end
    end
  end

  context "with non existing direct message channel" do
    it "creates a new chat channel" do
      expect { subject.create!(acting_user: user_1, target_users: [user_1, user_2]) }.to change {
        ChatChannel.count
      }.by(1)
    end

    it "creates UserChatChannelMembership records and sets their notification levels" do
      expect { subject.create!(acting_user: user_1, target_users: [user_1, user_2]) }.to change {
        UserChatChannelMembership.count
      }.by(2)

      chat_channel = ChatChannel.last
      user_1_membership =
        UserChatChannelMembership.find_by(user_id: user_1.id, chat_channel_id: chat_channel)
      expect(user_1_membership.last_read_message_id).to eq(nil)
      expect(user_1_membership.desktop_notification_level).to eq("always")
      expect(user_1_membership.mobile_notification_level).to eq("always")
      expect(user_1_membership.muted).to eq(false)
      expect(user_1_membership.following).to eq(true)
    end

    it "publishes the new DM channel message bus message for each user" do
      messages =
        MessageBus
          .track_publish { subject.create!(acting_user: user_1, target_users: [user_1, user_2]) }
          .filter { |m| m.channel == "/chat/new-channel" }

      chat_channel = ChatChannel.last
      expect(messages.count).to eq(2)
      expect(messages.first[:data]).to be_kind_of(Hash)
      expect(messages.map { |m| m.dig(:data, :chat_channel, :id) }).to eq(
        [chat_channel.id, chat_channel.id],
      )
    end

    it "allows a user to create a direct message to themselves" do
      expect { subject.create!(acting_user: user_1, target_users: [user_1]) }.to change {
        ChatChannel.count
      }.by(1).and change { UserChatChannelMembership.count }.by(1)
    end

    it "deduplicates target_users" do
      expect { subject.create!(acting_user: user_1, target_users: [user_1, user_1]) }.to change {
        ChatChannel.count
      }.by(1).and change { UserChatChannelMembership.count }.by(1)
    end

    context "when the user is not a member of direct_message_enabled_groups" do
      before { SiteSetting.direct_message_enabled_groups = Group::AUTO_GROUPS[:trust_level_4] }

      it "raises an error and does not change membership or channel counts" do
        channel_count = ChatChannel.count
        membership_count = UserChatChannelMembership.count
        expect {
          subject.create!(acting_user: user_1, target_users: [user_1, user_2])
        }.to raise_error(Discourse::InvalidAccess)
        expect(ChatChannel.count).to eq(channel_count)
        expect(UserChatChannelMembership.count).to eq(membership_count)
      end

      context "when user is staff" do
        before { user_1.update!(admin: true) }

        it "creates a new chat channel" do
          expect {
            subject.create!(acting_user: user_1, target_users: [user_1, user_2])
          }.to change { ChatChannel.count }.by(1)
        end
      end
    end
  end

  describe "ignoring, muting, and preventing DMs from other users" do
    context "when any of the users that the acting user is open in a DM with are ignoring the acting user" do
      before do
        Fabricate(:ignored_user, user: user_2, ignored_user: user_1, expiring_at: 1.day.from_now)
      end

      it "raises an error with a helpful message" do
        expect {
          subject.create!(acting_user: user_1, target_users: [user_1, user_2, user_3])
        }.to raise_error(
          Chat::DirectMessageChannelCreator::NotAllowed,
          I18n.t("chat.errors.not_accepting_dms", username: user_2.username),
        )
      end

      it "does not let the ignoring user create a DM either and raises an error with a helpful message" do
        expect {
          subject.create!(acting_user: user_2, target_users: [user_2, user_1, user_3])
        }.to raise_error(
          Chat::DirectMessageChannelCreator::NotAllowed,
          I18n.t("chat.errors.actor_ignoring_target_user", username: user_1.username),
        )
      end
    end

    context "when any of the users that the acting user is open in a DM with are muting the acting user" do
      before { Fabricate(:muted_user, user: user_2, muted_user: user_1) }

      it "raises an error with a helpful message" do
        expect {
          subject.create!(acting_user: user_1, target_users: [user_1, user_2, user_3])
        }.to raise_error(
          Chat::DirectMessageChannelCreator::NotAllowed,
          I18n.t("chat.errors.not_accepting_dms", username: user_2.username),
        )
      end

      it "does not let the muting user create a DM either and raises an error with a helpful message" do
        expect {
          subject.create!(acting_user: user_2, target_users: [user_2, user_1, user_3])
        }.to raise_error(
          Chat::DirectMessageChannelCreator::NotAllowed,
          I18n.t("chat.errors.actor_muting_target_user", username: user_1.username),
        )
      end
    end

    context "when any of the users that the acting user is open in a DM with is preventing private/direct messages" do
      before { user_2.user_option.update(allow_private_messages: false) }

      it "raises an error with a helpful message" do
        expect {
          subject.create!(acting_user: user_1, target_users: [user_1, user_2, user_3])
        }.to raise_error(
          Chat::DirectMessageChannelCreator::NotAllowed,
          I18n.t("chat.errors.not_accepting_dms", username: user_2.username),
        )
      end

      it "does not let the user who is preventing PM/DM create a DM either and raises an error with a helpful message" do
        expect {
          subject.create!(acting_user: user_2, target_users: [user_2, user_1, user_3])
        }.to raise_error(
          Chat::DirectMessageChannelCreator::NotAllowed,
          I18n.t("chat.errors.actor_disallowed_dms"),
        )
      end
    end

    context "when any of the users that the acting user is open in a DM with only allow private/direct messages from certain users" do
      before { user_2.user_option.update!(enable_allowed_pm_users: true) }

      it "raises an error with a helpful message" do
        expect {
          subject.create!(acting_user: user_1, target_users: [user_1, user_2, user_3])
        }.to raise_error(Chat::DirectMessageChannelCreator::NotAllowed)
      end

      it "does not raise an error if the acting user is allowed to send the PM" do
        AllowedPmUser.create!(user: user_2, allowed_pm_user: user_1)
        expect {
          subject.create!(acting_user: user_1, target_users: [user_1, user_2, user_3])
        }.to change { ChatChannel.count }.by(1)
      end

      it "does not let the user who is preventing PM/DM create a DM either and raises an error with a helpful message" do
        expect {
          subject.create!(acting_user: user_2, target_users: [user_2, user_1, user_3])
        }.to raise_error(
          Chat::DirectMessageChannelCreator::NotAllowed,
          I18n.t("chat.errors.actor_preventing_target_user_from_dm", username: user_1.username),
        )
      end
    end
  end
end
