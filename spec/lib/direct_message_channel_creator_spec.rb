# frozen_string_literal: true

require "rails_helper"

describe DiscourseChat::DirectMessageChannelCreator do
  fab!(:user_1) { Fabricate(:user) }
  fab!(:user_2) { Fabricate(:user) }
  fab!(:user_3) { Fabricate(:user) }

  context "existing direct message channel" do
    fab!(:dm_chat_channel) do
      Fabricate(
        :chat_channel,
        chatable: Fabricate(:direct_message_channel, users: [user_1, user_2]),
      )
    end
    fab!(:own_chat_channel) do
      Fabricate(:chat_channel, chatable: Fabricate(:direct_message_channel, users: [user_1]))
    end

    it "doesn't create a new chat channel" do
      existing_channel = nil
      expect {
        existing_channel = subject.create!(acting_user: user_1, target_users: [user_1, user_2])
      }.to change { ChatChannel.count }.by(0)
      expect(existing_channel).to eq(dm_chat_channel)
    end

    it "creates UserChatChannelMembership records and sets their notification levels" do
      expect { subject.create!(acting_user: user_1, target_users: [user_1, user_2]) }.to change {
        UserChatChannelMembership.count
      }.by(2)

      user_1_membership =
        UserChatChannelMembership.find_by(user_id: user_1.id, chat_channel_id: dm_chat_channel)
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

      expect(messages.count).to eq(2)
      expect(messages.first[:data]).to be_kind_of(Hash)
      expect(messages.map { |m| m.dig(:data, :chat_channel, :id) }).to eq(
        [dm_chat_channel.id, dm_chat_channel.id],
      )
    end

    it "allows a user to create a direct message to themselves, without creating a new channel" do
      existing_channel = nil
      expect {
        existing_channel = subject.create!(acting_user: user_1, target_users: [user_1])
      }.to change { ChatChannel.count }.by(0).and change { UserChatChannelMembership.count }.by(1)
      expect(existing_channel).to eq(own_chat_channel)
    end

    it "deduplicates target_users" do
      existing_channel = nil
      expect {
        existing_channel = subject.create!(acting_user: user_1, target_users: [user_1, user_1])
      }.to change { ChatChannel.count }.by(0).and change { UserChatChannelMembership.count }.by(1)
      expect(existing_channel).to eq(own_chat_channel)
    end
  end

  context "non existing direct message channel" do
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
  end

  describe "ignoring, muting, and preventing DMs from other users" do
    context "when any of the users that the acting user is open in a DM with are ignoring the acting user" do
      before do
        Fabricate(:ignored_user, user: user_2, ignored_user: user_1, expiring_at: 1.day.from_now)
      end

      it "raises an error with a helpful message" do
        expect {
          subject.create!(acting_user: user_1, target_users: [user_1, user_2, user_3])
        }.to raise_error(DiscourseChat::DirectMessageChannelCreator::NotAllowed)
      end
    end

    context "when any of the users that the acting user is open in a DM with are muting the acting user" do
      before { Fabricate(:muted_user, user: user_2, muted_user: user_1) }

      it "raises an error with a helpful message" do
        expect {
          subject.create!(acting_user: user_1, target_users: [user_1, user_2, user_3])
        }.to raise_error(DiscourseChat::DirectMessageChannelCreator::NotAllowed)
      end
    end

    context "when any of the users that the acting user is open in a DM with is preventing private/direct messages" do
      before { user_2.user_option.update(allow_private_messages: false) }

      it "raises an error with a helpful message" do
        expect {
          subject.create!(acting_user: user_1, target_users: [user_1, user_2, user_3])
        }.to raise_error(DiscourseChat::DirectMessageChannelCreator::NotAllowed)
      end
    end

    context "when any of the users that the acting user is open in a DM with only allow private/direct messages from certain users" do
      before { user_2.user_option.update!(enable_allowed_pm_users: true) }

      it "raises an error with a helpful message" do
        expect {
          subject.create!(acting_user: user_1, target_users: [user_1, user_2, user_3])
        }.to raise_error(DiscourseChat::DirectMessageChannelCreator::NotAllowed)
      end

      it "does not raise an error if the acting user is allowed to send the PM" do
        AllowedPmUser.create!(user: user_2, allowed_pm_user: user_1)
        expect {
          subject.create!(acting_user: user_1, target_users: [user_1, user_2, user_3])
        }.to change { ChatChannel.count }.by(1)
      end
    end
  end
end
