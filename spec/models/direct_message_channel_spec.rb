# frozen_string_literal: true

require 'rails_helper'

describe DirectMessageChannel do
  fab!(:user1) { Fabricate(:user) }
  fab!(:user2) { Fabricate(:user) }
  fab!(:chat_channel) { Fabricate(:chat_channel, chatable: Fabricate(:topic)) }

  describe "#chat_channel_title_for_user" do
    it "returns the channel id if there are more than two users" do
      user3 = Fabricate.build(:user)
      direct_message_channel = Fabricate(:direct_message_channel, users: [user1, user2, user3])

      expect(direct_message_channel.chat_channel_title_for_user(chat_channel, user1)).to eq chat_channel.id
    end

    it "returns the other user's username if it's a dm to that user" do
      direct_message_channel = Fabricate(:direct_message_channel, users: [user1, user2])

      expect(direct_message_channel.chat_channel_title_for_user(chat_channel, user1)).to eq "@#{user2.username}"
    end

    it "returns the current user's username if it's a dm to self" do
      direct_message_channel = Fabricate(:direct_message_channel, users: [user1])

      expect(direct_message_channel.chat_channel_title_for_user(chat_channel, user1)).to eq "@#{user1.username}"
    end

    it "returns the channel id if the user is deleted" do
      direct_message_channel = Fabricate(:direct_message_channel, users: [user1, user2])
      user2.destroy!
      direct_message_channel.reload

      expect(direct_message_channel.chat_channel_title_for_user(chat_channel, user1)).to eq chat_channel.id
    end
  end
end
