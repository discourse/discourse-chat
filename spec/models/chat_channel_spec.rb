# frozen_string_literal: true

require 'rails_helper'

describe ChatChannel do
  fab!(:user1) { Fabricate(:user) }
  fab!(:user2) { Fabricate(:user) }
  fab!(:group) { Fabricate(:group) }
  fab!(:public_topic_channel) { Fabricate(:chat_channel, chatable: Fabricate(:topic)) }
  fab!(:private_category) { Fabricate(:private_category, group: group) }
  fab!(:private_category_channel) { Fabricate(:chat_channel, chatable: private_category) }
  fab!(:private_topic_channel) { Fabricate(:chat_channel, chatable: Fabricate(:topic, category: private_category)) }
  fab!(:direct_message_channel) { Fabricate(:chat_channel, chatable: Fabricate(:direct_message_channel, users: [user1, user2])) }

  describe "#allowed_user_ids" do
    it "is correct for each channel type" do
      expect(private_category_channel.allowed_user_ids).to eq(nil)
      expect(private_topic_channel.allowed_user_ids).to eq(nil)
      expect(public_topic_channel.allowed_user_ids).to eq(nil)
      expect(direct_message_channel.allowed_user_ids).to match_array([user1.id, user2.id])
    end
  end

  describe "#allowed_group_ids" do
    it "is correct for each channel type" do
      expect(private_category_channel.allowed_group_ids).to eq([group.id])
      expect(private_topic_channel.allowed_group_ids).to eq([group.id])
      expect(public_topic_channel.allowed_group_ids).to eq(nil)
      expect(direct_message_channel.allowed_group_ids).to eq(nil)
    end
  end
end
