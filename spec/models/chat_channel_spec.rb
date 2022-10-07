# frozen_string_literal: true

require "rails_helper"

describe ChatChannel do
  fab!(:user1) { Fabricate(:user) }
  fab!(:user2) { Fabricate(:user) }
  fab!(:staff) { Fabricate(:user, admin: true) }
  fab!(:group) { Fabricate(:group) }
  fab!(:private_category) { Fabricate(:private_category, group: group) }
  fab!(:private_category_channel) { Fabricate(:chat_channel, chatable: private_category) }
  fab!(:direct_message_channel) do
    Fabricate(:chat_channel, chatable: Fabricate(:direct_message_channel, users: [user1, user2]))
  end

  describe "#allowed_user_ids" do
    it "returns participants when the channel is a DM" do
      expect(direct_message_channel.allowed_user_ids).to contain_exactly(user1.id, user2.id)
    end

    it "returns nil for regular channels" do
      group.add(user1)

      expect(private_category_channel.allowed_user_ids).to eq(nil)
    end
  end

  describe "#allowed_group_ids" do
    it "returns groups with access to the associated category" do
      staff_groups = Group::AUTO_GROUPS.slice(:staff, :moderators, :admins).values

      expect(private_category_channel.allowed_group_ids).to contain_exactly(*staff_groups, group.id)
    end

    it "returns nil when for DMs" do
      expect(direct_message_channel.allowed_group_ids).to eq(nil)
    end

    it "returns nil for public channels" do
      public_category = Fabricate(:category, read_restricted: false)
      public_channel = Fabricate(:chat_channel, chatable: public_category)

      expect(public_channel.allowed_group_ids).to eq(nil)
    end
  end

  describe "#read_restricted?" do
    it "returns true for a DM" do
      expect(direct_message_channel.read_restricted?).to eq(true)
    end

    it "returns false for channels associated to public categories" do
      public_category = Fabricate(:category, read_restricted: false)
      public_channel = Fabricate(:chat_channel, chatable: public_category)

      expect(public_channel.read_restricted?).to eq(false)
    end

    it "returns true for channels associated to private categories" do
      expect(private_category_channel.read_restricted?).to eq(true)
    end
  end

  describe "#closed!" do
    before { private_category_channel.update!(status: :open) }

    it "does nothing if user is not staff" do
      private_category_channel.closed!(user1)
      expect(private_category_channel.reload.open?).to eq(true)
    end

    it "closes the channel, logs a staff action, and sends an event" do
      events = []
      messages =
        MessageBus.track_publish do
          events = DiscourseEvent.track_events { private_category_channel.closed!(staff) }
        end

      expect(events).to include(
        event_name: :chat_channel_status_change,
        params: [{ channel: private_category_channel, old_status: "open", new_status: "closed" }],
      )
      expect(messages.first.channel).to eq("/chat/channel-status")
      expect(messages.first.data).to eq(
        { chat_channel_id: private_category_channel.id, status: "closed" },
      )
      expect(private_category_channel.reload.closed?).to eq(true)

      expect(
        UserHistory.exists?(
          acting_user_id: staff.id,
          action: UserHistory.actions[:custom_staff],
          custom_type: "chat_channel_status_change",
          new_value: :closed,
          previous_value: :open,
        ),
      ).to eq(true)
    end
  end

  describe "#open!" do
    before { private_category_channel.update!(status: :closed) }

    it "does nothing if user is not staff" do
      private_category_channel.open!(user1)
      expect(private_category_channel.reload.closed?).to eq(true)
    end

    it "does nothing if the channel is archived" do
      private_category_channel.update!(status: :archived)
      private_category_channel.open!(staff)
      expect(private_category_channel.reload.archived?).to eq(true)
    end

    it "opens the channel, logs a staff action, and sends an event" do
      events = []
      messages =
        MessageBus.track_publish do
          events = DiscourseEvent.track_events { private_category_channel.open!(staff) }
        end

      expect(events).to include(
        event_name: :chat_channel_status_change,
        params: [{ channel: private_category_channel, old_status: "closed", new_status: "open" }],
      )
      expect(messages.first.channel).to eq("/chat/channel-status")
      expect(messages.first.data).to eq(
        { chat_channel_id: private_category_channel.id, status: "open" },
      )
      expect(private_category_channel.reload.open?).to eq(true)

      expect(
        UserHistory.exists?(
          acting_user_id: staff.id,
          action: UserHistory.actions[:custom_staff],
          custom_type: "chat_channel_status_change",
          new_value: :open,
          previous_value: :closed,
        ),
      ).to eq(true)
    end
  end

  describe "#read_only!" do
    before { private_category_channel.update!(status: :open) }

    it "does nothing if user is not staff" do
      private_category_channel.read_only!(user1)
      expect(private_category_channel.reload.open?).to eq(true)
    end

    it "marks the channel read_only, logs a staff action, and sends an event" do
      events = []
      messages =
        MessageBus.track_publish do
          events = DiscourseEvent.track_events { private_category_channel.read_only!(staff) }
        end

      expect(events).to include(
        event_name: :chat_channel_status_change,
        params: [
          { channel: private_category_channel, old_status: "open", new_status: "read_only" },
        ],
      )
      expect(messages.first.channel).to eq("/chat/channel-status")
      expect(messages.first.data).to eq(
        { chat_channel_id: private_category_channel.id, status: "read_only" },
      )
      expect(private_category_channel.reload.read_only?).to eq(true)

      expect(
        UserHistory.exists?(
          acting_user_id: staff.id,
          action: UserHistory.actions[:custom_staff],
          custom_type: "chat_channel_status_change",
          new_value: :read_only,
          previous_value: :open,
        ),
      ).to eq(true)
    end
  end

  describe ".public_channels" do
    context "when a category used as chatable is destroyed" do
      fab!(:category_channel_1) { Fabricate(:chat_channel, chatable: Fabricate(:category)) }
      fab!(:category_channel_2) { Fabricate(:chat_channel, chatable: Fabricate(:category)) }

      before { category_channel_1.chatable.destroy! }

      it "doesn’t list the channel" do
        ids = ChatChannel.public_channels.pluck(:chatable_id)
        expect(ids).to_not include(category_channel_1.chatable_id)
        expect(ids).to include(category_channel_2.chatable_id)
      end
    end
  end

  describe "#archived!" do
    before { private_category_channel.update!(status: :read_only) }

    it "does nothing if user is not staff" do
      private_category_channel.archived!(user1)
      expect(private_category_channel.reload.read_only?).to eq(true)
    end

    it "does nothing if already archived" do
      private_category_channel.update!(status: :archived)
      private_category_channel.archived!(user1)
      expect(private_category_channel.reload.archived?).to eq(true)
    end

    it "does nothing if the channel is not already readonly" do
      private_category_channel.update!(status: :open)
      private_category_channel.archived!(staff)
      expect(private_category_channel.reload.open?).to eq(true)
      private_category_channel.update!(status: :read_only)
      private_category_channel.archived!(staff)
      expect(private_category_channel.reload.archived?).to eq(true)
    end

    it "marks the channel archived, logs a staff action, and sends an event" do
      events = []
      messages =
        MessageBus.track_publish do
          events = DiscourseEvent.track_events { private_category_channel.archived!(staff) }
        end

      expect(events).to include(
        event_name: :chat_channel_status_change,
        params: [
          { channel: private_category_channel, old_status: "read_only", new_status: "archived" },
        ],
      )
      expect(messages.first.channel).to eq("/chat/channel-status")
      expect(messages.first.data).to eq(
        { chat_channel_id: private_category_channel.id, status: "archived" },
      )
      expect(private_category_channel.reload.archived?).to eq(true)

      expect(
        UserHistory.exists?(
          acting_user_id: staff.id,
          action: UserHistory.actions[:custom_staff],
          custom_type: "chat_channel_status_change",
          new_value: :archived,
          previous_value: :read_only,
        ),
      ).to eq(true)
    end
  end

  it "is valid if name is long enough" do
    SiteSetting.max_topic_title_length = 5
    channel = described_class.new(name: "a")
    channel = described_class.new(name: "a" * SiteSetting.max_topic_title_length)
    expect(channel).to be_valid
  end

  it "is invalid if name is too long" do
    channel = described_class.new(name: "a" * (SiteSetting.max_topic_title_length + 1))
    expect(channel).to be_invalid
  end

  it "is invalid if name is empty" do
    channel = described_class.new(name: "")
    expect(channel).to be_invalid
  end

  it "is valid if name is nil" do
    channel = described_class.new(name: nil)
    expect(channel).to be_valid
  end

  describe "#add" do
    before { group.add(user1) }

    it "creates a membership for the user and enqueues a job to update the count" do
      initial_count = private_category_channel.user_count

      membership = private_category_channel.add(user1)
      private_category_channel.reload

      expect(membership.following).to eq(true)
      expect(membership.user).to eq(user1)
      expect(membership.chat_channel).to eq(private_category_channel)
      expect(private_category_channel.user_count_stale).to eq(true)
      expect_job_enqueued(
        job: :update_channel_user_count,
        args: {
          chat_channel_id: private_category_channel.id,
        },
      )
    end

    it "updates an existing membership for the user and enqueues a job to update the count" do
      membership =
        UserChatChannelMembership.create!(
          chat_channel: private_category_channel,
          user: user1,
          following: false,
        )

      private_category_channel.add(user1)
      private_category_channel.reload

      expect(membership.reload.following).to eq(true)
      expect(private_category_channel.user_count_stale).to eq(true)
      expect_job_enqueued(
        job: :update_channel_user_count,
        args: {
          chat_channel_id: private_category_channel.id,
        },
      )
    end

    it "does nothing if the user is already a member" do
      membership =
        UserChatChannelMembership.create!(
          chat_channel: private_category_channel,
          user: user1,
          following: true,
        )

      expect(private_category_channel.user_count_stale).to eq(false)
      expect_not_enqueued_with(
        job: :update_channel_user_count,
        args: {
          chat_channel_id: private_category_channel.id,
        },
      ) { private_category_channel.add(user1) }
    end

    it "does not recalculate user count if it's already been marked as stale" do
      private_category_channel.update!(user_count_stale: true)
      expect_not_enqueued_with(
        job: :update_channel_user_count,
        args: {
          chat_channel_id: private_category_channel.id,
        },
      ) { private_category_channel.add(user1) }
    end
  end

  describe "#remove" do
    before do
      group.add(user1)
      @membership = private_category_channel.add(user1)
      private_category_channel.reload
      private_category_channel.update!(user_count_stale: false)
    end

    it "updates the membership for the user and decreases the count" do
      membership = private_category_channel.remove(user1)
      private_category_channel.reload

      expect(@membership.reload.following).to eq(false)
      expect(private_category_channel.user_count_stale).to eq(true)
      expect_job_enqueued(
        job: :update_channel_user_count,
        args: {
          chat_channel_id: private_category_channel.id,
        },
      )
    end

    it "returns nil if the user doesn't have a membership" do
      expect(private_category_channel.remove(user2)).to eq(nil)
    end

    it "does nothing if the user is not following the channel" do
      @membership.update!(following: false)

      private_category_channel.remove(user1)
      private_category_channel.reload

      expect(private_category_channel.user_count_stale).to eq(false)
      expect_job_enqueued(
        job: :update_channel_user_count,
        args: {
          chat_channel_id: private_category_channel.id,
        },
      )
    end

    it "does not recalculate user count if it's already been marked as stale" do
      private_category_channel.update!(user_count_stale: true)
      expect_not_enqueued_with(
        job: :update_channel_user_count,
        args: {
          chat_channel_id: private_category_channel.id,
        },
      ) { private_category_channel.remove(user1) }
    end
  end
end
