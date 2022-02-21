# frozen_string_literal: true

require 'rails_helper'

describe ChatChannel do
  fab!(:user1) { Fabricate(:user) }
  fab!(:user2) { Fabricate(:user) }
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

  describe "#close!" do
    before do
      public_topic_channel.update!(status: ChatChannel.statuses[:open])
    end

    it "does nothing if user is not staff" do
      public_topic_channel.close!(user1)
      expect(public_topic_channel.reload.status).to eq(ChatChannel.statuses[:open])
    end

    it "closes the channel, logs a staff action, and sends an event" do
      events = []
      messages = MessageBus.track_publish do
        events = DiscourseEvent.track_events do
          public_topic_channel.close!(staff)
        end
      end

      expect(events).to include(event_name: :chat_channel_status_change, params: [{
        channel: public_topic_channel,
        old_status: ChatChannel.statuses[:open],
        new_status: ChatChannel.statuses[:closed]
      }])
      expect(messages.first.channel).to eq("/chat/channel-status")
      expect(messages.first.data).to eq({ chat_channel_id: public_topic_channel.id, status: ChatChannel.statuses[:closed] })
      expect(public_topic_channel.reload.status).to eq(ChatChannel.statuses[:closed])

      expect(
        UserHistory.exists?(
          acting_user_id: staff.id,
          action: UserHistory.actions[:custom_staff],
          custom_type: "chat_channel_status_change",
          new_value: ChatChannel.statuses[:closed],
          previous_value: ChatChannel.statuses[:open]
        )
      ).to eq(true)
    end
  end

  describe "#open!" do
    before do
      public_topic_channel.update!(status: ChatChannel.statuses[:closed])
    end

    it "does nothing if user is not staff" do
      public_topic_channel.open!(user1)
      expect(public_topic_channel.reload.status).to eq(ChatChannel.statuses[:closed])
    end

    it "does nothing if the channel is archived" do
      public_topic_channel.update!(status: ChatChannel.statuses[:archived])
      public_topic_channel.open!(staff)
      expect(public_topic_channel.reload.status).to eq(ChatChannel.statuses[:archived])
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
        old_status: ChatChannel.statuses[:closed],
        new_status: ChatChannel.statuses[:open]
      }])
      expect(messages.first.channel).to eq("/chat/channel-status")
      expect(messages.first.data).to eq({ chat_channel_id: public_topic_channel.id, status: ChatChannel.statuses[:open] })
      expect(public_topic_channel.reload.status).to eq(ChatChannel.statuses[:open])

      expect(
        UserHistory.exists?(
          acting_user_id: staff.id,
          action: UserHistory.actions[:custom_staff],
          custom_type: "chat_channel_status_change",
          new_value: ChatChannel.statuses[:open],
          previous_value: ChatChannel.statuses[:closed]
        )
      ).to eq(true)
    end
  end

  describe "#read_only!" do
    before do
      public_topic_channel.update!(status: ChatChannel.statuses[:open])
    end

    it "does nothing if user is not staff" do
      public_topic_channel.read_only!(user1)
      expect(public_topic_channel.reload.status).to eq(ChatChannel.statuses[:open])
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
        old_status: ChatChannel.statuses[:open],
        new_status: ChatChannel.statuses[:read_only]
      }])
      expect(messages.first.channel).to eq("/chat/channel-status")
      expect(messages.first.data).to eq({ chat_channel_id: public_topic_channel.id, status: ChatChannel.statuses[:read_only] })
      expect(public_topic_channel.reload.status).to eq(ChatChannel.statuses[:read_only])

      expect(
        UserHistory.exists?(
          acting_user_id: staff.id,
          action: UserHistory.actions[:custom_staff],
          custom_type: "chat_channel_status_change",
          new_value: ChatChannel.statuses[:read_only],
          previous_value: ChatChannel.statuses[:open]
        )
      ).to eq(true)
    end
  end

  describe "#archive!" do
    before do
      public_topic_channel.update!(status: ChatChannel.statuses[:read_only])
    end

    it "does nothing if user is not staff" do
      public_topic_channel.archive!(user1)
      expect(public_topic_channel.reload.status).to eq(ChatChannel.statuses[:read_only])
    end

    it "does nothing if already archived" do
      public_topic_channel.update!(status: ChatChannel.statuses[:archived])
      public_topic_channel.archive!(user1)
      expect(public_topic_channel.reload.status).to eq(ChatChannel.statuses[:archived])
    end

    it "does nothing if the channel is not already readonly" do
      public_topic_channel.update!(status: ChatChannel.statuses[:open])
      public_topic_channel.archive!(staff)
      expect(public_topic_channel.reload.status).to eq(ChatChannel.statuses[:open])
      public_topic_channel.update!(status: ChatChannel.statuses[:read_only])
      public_topic_channel.archive!(staff)
      expect(public_topic_channel.reload.status).to eq(ChatChannel.statuses[:archived])
    end

    it "marks the channel archived, logs a staff action, and sends an event" do
      events = []
      messages = MessageBus.track_publish do
        events = DiscourseEvent.track_events do
          public_topic_channel.archive!(staff)
        end
      end

      expect(events).to include(event_name: :chat_channel_status_change, params: [{
        channel: public_topic_channel,
        old_status: ChatChannel.statuses[:read_only],
        new_status: ChatChannel.statuses[:archived]
      }])
      expect(messages.first.channel).to eq("/chat/channel-status")
      expect(messages.first.data).to eq({ chat_channel_id: public_topic_channel.id, status: ChatChannel.statuses[:archived] })
      expect(public_topic_channel.reload.status).to eq(ChatChannel.statuses[:archived])

      expect(
        UserHistory.exists?(
          acting_user_id: staff.id,
          action: UserHistory.actions[:custom_staff],
          custom_type: "chat_channel_status_change",
          new_value: ChatChannel.statuses[:archived],
          previous_value: ChatChannel.statuses[:read_only]
        )
      ).to eq(true)
    end
  end
end
