# frozen_string_literal: true

require 'rails_helper'

describe DiscourseChat::DirectMessageChannelCreator do
  fab!(:user_1) { Fabricate(:user) }
  fab!(:user_2) { Fabricate(:user) }

  context "existing direct message channel" do
    fab!(:dm_chat_channel) { Fabricate(:chat_channel, chatable: Fabricate(:direct_message_channel, users: [user_1, user_2])) }
    fab!(:own_chat_channel) { Fabricate(:chat_channel, chatable: Fabricate(:direct_message_channel, users: [user_1])) }

    it "doesn't create a new chat channel" do
      existing_channel = nil
      expect {
        existing_channel = subject.create!(target_users: [user_1, user_2])
      }.to change { ChatChannel.count }.by(0)
      expect(existing_channel).to eq(dm_chat_channel)
    end

    it "creates UserChatChannelMembership records and sets their notification levels" do
      expect {
        subject.create!(target_users: [user_1, user_2])
      }.to change { UserChatChannelMembership.count }.by(2)

      user_1_membership = UserChatChannelMembership.find_by(user_id: user_1.id, chat_channel_id: dm_chat_channel)
      expect(user_1_membership.last_read_message_id).to eq(nil)
      expect(user_1_membership.desktop_notification_level).to eq("always")
      expect(user_1_membership.mobile_notification_level).to eq("always")
      expect(user_1_membership.muted).to eq(false)
      expect(user_1_membership.following).to eq(true)
    end

    it "publishes the new DM channel message bus message for each user" do
      messages = MessageBus.track_publish do
        subject.create!(target_users: [user_1, user_2])
      end.filter { |m| m.channel == "/chat/new-channel" }
      expect(messages.count).to eq(2)
      expect(messages.first[:data]).to be_kind_of(Hash)
      expect(messages.map { |m| m.dig(:data, :chat_channel, :id) }).to eq([dm_chat_channel.id, dm_chat_channel.id])
    end

    it "allows a user to create a direct message to themself, without creating a new channel" do
      existing_channel = nil
      expect {
        existing_channel = subject.create!(target_users: [user_1])
      }.to change { ChatChannel.count }.by(0).and change { UserChatChannelMembership.count }.by(1)
      expect(existing_channel).to eq(own_chat_channel)
    end

    it "deduplicates target_users" do
      existing_channel = nil
      expect {
        existing_channel = subject.create!(target_users: [user_1, user_1])
      }.to change { ChatChannel.count }.by(0).and change { UserChatChannelMembership.count }.by(1)
      expect(existing_channel).to eq(own_chat_channel)
    end
  end

  context "non existing direct message channel" do
    it "creates a new chat channel" do
      expect {
        subject.create!(target_users: [user_1, user_2])
      }.to change { ChatChannel.count }.by(1)
    end

    it "creates UserChatChannelMembership records and sets their notification levels" do
      expect {
        subject.create!(target_users: [user_1, user_2])
      }.to change { UserChatChannelMembership.count }.by(2)

      chat_channel = ChatChannel.last
      user_1_membership = UserChatChannelMembership.find_by(user_id: user_1.id, chat_channel_id: chat_channel)
      expect(user_1_membership.last_read_message_id).to eq(nil)
      expect(user_1_membership.desktop_notification_level).to eq("always")
      expect(user_1_membership.mobile_notification_level).to eq("always")
      expect(user_1_membership.muted).to eq(false)
      expect(user_1_membership.following).to eq(true)
    end

    it "publishes the new DM channel message bus message for each user" do
      messages = MessageBus.track_publish do
        subject.create!(target_users: [user_1, user_2])
      end.filter { |m| m.channel == "/chat/new-channel" }

      chat_channel = ChatChannel.last
      expect(messages.count).to eq(2)
      expect(messages.first[:data]).to be_kind_of(Hash)
      expect(messages.map { |m| m.dig(:data, :chat_channel, :id) }).to eq([chat_channel.id, chat_channel.id])
    end

    it "allows a user to create a direct message to themself" do
      expect {
        subject.create!(target_users: [user_1])
      }.to change { ChatChannel.count }.by(1).and change { UserChatChannelMembership.count }.by(1)
    end

    it "deduplicates target_users" do
      expect {
        subject.create!(target_users: [user_1, user_1])
      }.to change { ChatChannel.count }.by(1).and change { UserChatChannelMembership.count }.by(1)
    end
  end
end
