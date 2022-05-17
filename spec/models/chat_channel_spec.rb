# frozen_string_literal: true

require 'rails_helper'

describe ChatChannel do
  fab!(:user1) { Fabricate(:user) }
  fab!(:user2) { Fabricate(:user) }
  fab!(:user3) { Fabricate(:user) }
  fab!(:user4) { Fabricate(:user) }
  fab!(:user5) { Fabricate(:user) }
  fab!(:user6) { Fabricate(:user) }
  fab!(:user7) { Fabricate(:user) }
  fab!(:staff) { Fabricate(:user, admin: true) }
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

  describe "#closed!" do
    before do
      public_topic_channel.update!(status: :open)
    end

    it "does nothing if user is not staff" do
      public_topic_channel.closed!(user1)
      expect(public_topic_channel.reload.open?).to eq(true)
    end

    it "closes the channel, logs a staff action, and sends an event" do
      events = []
      messages = MessageBus.track_publish do
        events = DiscourseEvent.track_events do
          public_topic_channel.closed!(staff)
        end
      end

      expect(events).to include(event_name: :chat_channel_status_change, params: [{
        channel: public_topic_channel,
        old_status: :open,
        new_status: :closed
      }])
      expect(messages.first.channel).to eq("/chat/channel-status")
      expect(messages.first.data).to eq({ chat_channel_id: public_topic_channel.id, status: "closed" })
      expect(public_topic_channel.reload.closed?).to eq(true)

      expect(
        UserHistory.exists?(
          acting_user_id: staff.id,
          action: UserHistory.actions[:custom_staff],
          custom_type: "chat_channel_status_change",
          new_value: :closed,
          previous_value: :open
        )
      ).to eq(true)
    end
  end

  describe "#open!" do
    before do
      public_topic_channel.update!(status: :closed)
    end

    it "does nothing if user is not staff" do
      public_topic_channel.open!(user1)
      expect(public_topic_channel.reload.closed?).to eq(true)
    end

    it "does nothing if the channel is archived" do
      public_topic_channel.update!(status: :archived)
      public_topic_channel.open!(staff)
      expect(public_topic_channel.reload.archived?).to eq(true)
    end

    it "opens the channel, logs a staff action, and sends an event" do
      events = []
      messages = MessageBus.track_publish do
        events = DiscourseEvent.track_events do
          public_topic_channel.open!(staff)
        end
      end

      expect(events).to include(event_name: :chat_channel_status_change, params: [{
        channel: public_topic_channel,
        old_status: :closed,
        new_status: :open
      }])
      expect(messages.first.channel).to eq("/chat/channel-status")
      expect(messages.first.data).to eq({ chat_channel_id: public_topic_channel.id, status: "open" })
      expect(public_topic_channel.reload.open?).to eq(true)

      expect(
        UserHistory.exists?(
          acting_user_id: staff.id,
          action: UserHistory.actions[:custom_staff],
          custom_type: "chat_channel_status_change",
          new_value: :open,
          previous_value: :closed
        )
      ).to eq(true)
    end
  end

  describe "#read_only!" do
    before do
      public_topic_channel.update!(status: :open)
    end

    it "does nothing if user is not staff" do
      public_topic_channel.read_only!(user1)
      expect(public_topic_channel.reload.open?).to eq(true)
    end

    it "marks the channel read_only, logs a staff action, and sends an event" do
      events = []
      messages = MessageBus.track_publish do
        events = DiscourseEvent.track_events do
          public_topic_channel.read_only!(staff)
        end
      end

      expect(events).to include(event_name: :chat_channel_status_change, params: [{
        channel: public_topic_channel,
        old_status: :open,
        new_status: :read_only
      }])
      expect(messages.first.channel).to eq("/chat/channel-status")
      expect(messages.first.data).to eq({ chat_channel_id: public_topic_channel.id, status: "read_only" })
      expect(public_topic_channel.reload.read_only?).to eq(true)

      expect(
        UserHistory.exists?(
          acting_user_id: staff.id,
          action: UserHistory.actions[:custom_staff],
          custom_type: "chat_channel_status_change",
          new_value: :read_only,
          previous_value: :open
        )
      ).to eq(true)
    end
  end

  describe "#archived!" do
    before do
      public_topic_channel.update!(status: :read_only)
    end

    it "does nothing if user is not staff" do
      public_topic_channel.archived!(user1)
      expect(public_topic_channel.reload.read_only?).to eq(true)
    end

    it "does nothing if already archived" do
      public_topic_channel.update!(status: :archived)
      public_topic_channel.archived!(user1)
      expect(public_topic_channel.reload.archived?).to eq(true)
    end

    it "does nothing if the channel is not already readonly" do
      public_topic_channel.update!(status: :open)
      public_topic_channel.archived!(staff)
      expect(public_topic_channel.reload.open?).to eq(true)
      public_topic_channel.update!(status: :read_only)
      public_topic_channel.archived!(staff)
      expect(public_topic_channel.reload.archived?).to eq(true)
    end

    it "marks the channel archived, logs a staff action, and sends an event" do
      events = []
      messages = MessageBus.track_publish do
        events = DiscourseEvent.track_events do
          public_topic_channel.archived!(staff)
        end
      end

      expect(events).to include(event_name: :chat_channel_status_change, params: [{
        channel: public_topic_channel,
        old_status: :read_only,
        new_status: :archived
      }])
      expect(messages.first.channel).to eq("/chat/channel-status")
      expect(messages.first.data).to eq({ chat_channel_id: public_topic_channel.id, status: "archived" })
      expect(public_topic_channel.reload.archived?).to eq(true)

      expect(
        UserHistory.exists?(
          acting_user_id: staff.id,
          action: UserHistory.actions[:custom_staff],
          custom_type: "chat_channel_status_change",
          new_value: :archived,
          previous_value: :read_only
        )
      ).to eq(true)
    end
  end
end
