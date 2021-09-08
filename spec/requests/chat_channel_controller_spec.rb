# frozen_string_literal: true

require 'rails_helper'
require_relative '../fabricators/chat_fabricator'

RSpec.describe DiscourseChat::ChatChannelsController do
  fab!(:user) { Fabricate(:user) }
  fab!(:admin) { Fabricate(:admin) }
  fab!(:category) { Fabricate(:category) }
  fab!(:topic) { Fabricate(:topic, category: category) }
  fab!(:chat_channel) { Fabricate(:chat_channel, chatable: topic) }

  before do
    SiteSetting.topic_chat_enabled = true
    SiteSetting.topic_chat_restrict_to_staff = false # Change this per-test to false if needed
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
        mobile_notification_level: "never",
        desktop_notification_level: "always"
      }
      expect(response.status).to eq(200)
      chat_channel.reload
      expect(chat_channel.muted).to eq(true)
      expect(chat_channel.desktop_notification_level).to eq("never")
      expect(chat_channel.mobile_notification_level).to eq("always")

    end
  end
end
