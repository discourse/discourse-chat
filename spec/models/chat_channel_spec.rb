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

  describe "#close!" do
    it "does nothing if user is not staff" do
      public_topic_channel.close!(user1)
      expect(public_topic_channel.reload.closed).to eq(false)
    end

    it "closes the channel, logs a staff action, and sends an event" do
      user1.update(admin: true)
      events = []
      messages = MessageBus.track_publish do
        events = DiscourseEvent.track_events do
          public_topic_channel.close!(user1)
        end
      end

      expect(events).to include(event_name: :chat_channel_closed, params: [public_topic_channel])
      expect(messages.first.channel).to eq("/chat/channel-status")
      expect(messages.first.data).to eq({ chat_channel_id: public_topic_channel.id, closed: true, archived: false })
      expect(public_topic_channel.reload.closed).to eq(true)

      expect(
        UserHistory.exists?(
          acting_user_id: user1.id,
          action: UserHistory.actions[:custom_staff],
          custom_type: "chat_channel_closed"
        )
      ).to eq(true)
    end
  end

  describe "#open!" do
    before do
      public_topic_channel.close!(user1)
    end

    it "does nothing if user is not staff" do
      public_topic_channel.open!(user1)
      expect(public_topic_channel.reload.closed).to eq(false)
    end

    it "does nothing if the channel is archived" do
      user1.update(admin: true)
      public_topic_channel.update!(archived: true)
      public_topic_channel.open!(user1)
      expect(public_topic_channel.reload.closed).to eq(false)
    end

    it "opens the channel, logs a staff action, and sends an event" do
      user1.update(admin: true)
      events = []
      messages = MessageBus.track_publish do
        events = DiscourseEvent.track_events do
          public_topic_channel.open!(user1)
        end
      end

      expect(events).to include(event_name: :chat_channel_opened, params: [public_topic_channel])
      expect(messages.first.channel).to eq("/chat/channel-status")
      expect(messages.first.data).to eq({ chat_channel_id: public_topic_channel.id, closed: false, archived: false })
      expect(public_topic_channel.reload.closed).to eq(false)

      expect(
        UserHistory.exists?(
          acting_user_id: user1.id,
          action: UserHistory.actions[:custom_staff],
          custom_type: "chat_channel_opened"
        )
      ).to eq(true)
    end
  end
end
