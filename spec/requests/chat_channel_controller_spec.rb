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
end
