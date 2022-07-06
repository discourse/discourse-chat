# frozen_string_literal: true

require 'rails_helper'

describe Jobs::AutoManageChannelMemberships do
  fab!(:chatters_group) { Fabricate(:group) }
  fab!(:category) { Fabricate(:category) }

  before do
    SiteSetting.chat_enabled = true
    @channel = Fabricate(:chat_channel, auto_join_users: true, chatable: category)
  end

  describe 'queues batches to automatically add users to a channel' do
    let(:mode) { described_class::JOIN }

    before do
      @user = Fabricate(:user, last_seen_at: 15.minutes.ago)
      @category_group = Fabricate(:category_group, category: category, group: chatters_group)
    end

    it 'queues a batch for users with channel access' do
      Fabricate(:group_user, user: @user, group: chatters_group)

      assert_batches_enqueued(@channel, mode, 1)
    end

    it "doesn't queue a batch if the user is not a group member" do
      assert_batches_enqueued(@channel, mode, 0)
    end

    it "does nothing when the channel doesn't exist" do
      assert_batches_enqueued(ChatChannel.new(id: -1), mode, 0)
    end

    it 'does nothing when the chatable is not a category' do
      same_id = 99
      another_category = Fabricate(:category, id: same_id)
      another_cgroup = Fabricate(:category_group, category: another_category, group: chatters_group)
      topic = Fabricate(:topic, id: same_id)
      Fabricate(:group_user, user: @user, group: chatters_group)
      @channel.update!(chatable: topic)

      assert_batches_enqueued(@channel, mode, 0)
    end

    it 'excludes users not seen in the last 3 months' do
      Fabricate(:group_user, user: @user, group: chatters_group)
      @user.update!(last_seen_at: 3.months.ago)

      assert_batches_enqueued(@channel, mode, 0)
    end

    it 'includes users with last_seen_at set to null' do
      Fabricate(:group_user, user: @user, group: chatters_group)
      @user.update!(last_seen_at: nil)

      assert_batches_enqueued(@channel, mode, 1)
    end

    it 'excludes users without chat enabled' do
      Fabricate(:group_user, user: @user, group: chatters_group)
      @user.user_option.update!(chat_enabled: false)

      assert_batches_enqueued(@channel, mode, 0)
    end

    it 'respects the max_chat_auto_joined_users setting' do
      SiteSetting.max_chat_auto_joined_users = 0
      Fabricate(:group_user, user: @user, group: chatters_group)

      assert_batches_enqueued(@channel, mode, 0)
    end

    it 'ignores users that are already channel members' do
      UserChatChannelMembership.create!(user: @user, chat_channel: @channel, following: true)
      Fabricate(:group_user, user: @user, group: chatters_group)

      assert_batches_enqueued(@channel, mode, 0)
    end

    it "queues a batch when the user doesn't follow the channel" do
      UserChatChannelMembership.create!(user: @user, chat_channel: @channel, following: false)
      Fabricate(:group_user, user: @user, group: chatters_group)

      assert_batches_enqueued(@channel, mode, 1)
    end
  end

  describe 'queues batches to automatically remove users from a channel' do
    let(:mode) { described_class::REMOVE }
    fab!(:user) { Fabricate(:user) }

    before do
      @membership = UserChatChannelMembership.create!(user: user, chat_channel: @channel, following: true)
      Fabricate(:group_user, user: user, group: chatters_group)
    end

    it 'queues a batch when the users only had access through a removed group' do
      assert_batches_enqueued(@channel, mode, 1)
    end

    it "doesn't remove the user if it still has access through another group" do
      another_group = Fabricate(:group)
      Fabricate(:group_user, user: user, group: another_group)
      Fabricate(:category_group, category: category, group: another_group)

      assert_batches_enqueued(@channel, mode, 0)
    end

    it "does nothing if the user wasn't following the channel" do
      @membership.update!(following: false)

      assert_batches_enqueued(@channel, mode, 0)
    end

    it "doesn't care about the max_chat_auto_joined_users setting" do
      SiteSetting.max_chat_auto_joined_users = 0

      assert_batches_enqueued(@channel, mode, 1)
    end
  end

  def assert_batches_enqueued(channel, mode, expected)
    job_klass = mode == described_class::JOIN ? Jobs::AutoJoinChannelBatch : Jobs::AutoRemoveChannelBatch
    expect { subject.execute(mode: mode, chat_channel_id: channel.id) }.to change(job_klass.jobs, :size).by(expected)
  end
end
