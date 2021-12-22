# frozen_string_literal: true

require 'rails_helper'

describe DirectMessageChannel do
  fab!(:user1) { Fabricate(:user) }
  fab!(:user2) { Fabricate(:user) }
  fab!(:group) { Fabricate(:group) }
  fab!(:public_topic_channel) { Fabricate(:chat_channel, chatable: Fabricate(:topic)) }
  fab!(:private_category) { Fabricate(:private_category, group: group) }
  fab!(:private_category_channel) { Fabricate(:chat_channel, chatable: private_category) }
  fab!(:private_topic_channel) { Fabricate(:chat_channel, chatable: Fabricate(:topic, category: private_category)) }
  fab!(:direct_message_channel) { Fabricate(:chat_channel, chatable: Fabricate(:direct_message_channel, users: [user1, user2])) }

  describe "#chat_channel_title_for_user" do
    it "returns the channel id if there are more than two users" do
      user1 = Fabricate.build(:user)
      user2 = Fabricate.build(:user)
      user3 = Fabricate.build(:user)
      chat_channel = Fabricate.build(:chat_channel, chatable: Fabricate(:topic))
      direct_message_channel = Fabricate(:direct_message_channel, users: [user1, user2, user3])

      expect(direct_message_channel.chat_channel_title_for_user(chat_channel, user1)).to eq chat_channel.id
    end

    it "returns the other user's username if it's a dm to that user" do
      user1 = Fabricate.build(:user)
      user2 = Fabricate.build(:user)
      chat_channel = Fabricate.build(:chat_channel, chatable: Fabricate(:topic))
      direct_message_channel = Fabricate(:direct_message_channel, users: [user1, user2])

      expect(direct_message_channel.chat_channel_title_for_user(chat_channel, user1)).to eq "@#{user2.username}"
    end

    it "returns the current user's username if it's a dm to self" do
      user1 = Fabricate.build(:user)
      chat_channel = Fabricate.build(:chat_channel, chatable: Fabricate(:topic))
      direct_message_channel = Fabricate(:direct_message_channel, users: [user1])

      expect(direct_message_channel.chat_channel_title_for_user(chat_channel, user1)).to eq "@#{user1.username}"
    end
  end
end
