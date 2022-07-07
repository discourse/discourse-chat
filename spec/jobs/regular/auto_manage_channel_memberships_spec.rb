# frozen_string_literal: true

require 'rails_helper'

describe Jobs::AutoManageChannelMemberships do
  fab!(:chatters_group) { Fabricate(:group) }
  fab!(:private_category) { Fabricate(:private_category, group: chatters_group) }

  before do
    SiteSetting.chat_enabled = true
    @channel = Fabricate(:chat_channel, auto_join_users: true, chatable: private_category)
  end

  describe 'queues batches to automatically add users to a channel' do
    before do
      @user = Fabricate(:user, last_seen_at: 15.minutes.ago)
    end

    it 'queues a batch for users with channel access' do
      Fabricate(:group_user, user: @user, group: chatters_group)

      assert_batches_enqueued(@channel, 1)
    end

    it "doesn't queue a batch if the user is not a group member" do
      assert_batches_enqueued(@channel, 0)
    end

    it "does nothing when the channel doesn't exist" do
      assert_batches_enqueued(ChatChannel.new(id: -1), 0)
    end

    it 'does nothing when the chatable is not a category' do
      same_id = 99
      another_category = Fabricate(:private_category, id: same_id, group: chatters_group)
      dm_channel = Fabricate(:direct_message_channel, id: same_id)
      Fabricate(:group_user, user: @user, group: chatters_group)
      @channel.update!(chatable: dm_channel)

      assert_batches_enqueued(@channel, 0)
    end

    it 'excludes users not seen in the last 3 months' do
      Fabricate(:group_user, user: @user, group: chatters_group)
      @user.update!(last_seen_at: 3.months.ago)

      assert_batches_enqueued(@channel, 0)
    end

    it 'includes users with last_seen_at set to null' do
      Fabricate(:group_user, user: @user, group: chatters_group)
      @user.update!(last_seen_at: nil)

      assert_batches_enqueued(@channel, 1)
    end

    it 'excludes users without chat enabled' do
      Fabricate(:group_user, user: @user, group: chatters_group)
      @user.user_option.update!(chat_enabled: false)

      assert_batches_enqueued(@channel, 0)
    end

    it 'respects the max_chat_auto_joined_users setting' do
      SiteSetting.max_chat_auto_joined_users = 0
      Fabricate(:group_user, user: @user, group: chatters_group)

      assert_batches_enqueued(@channel, 0)
    end

    it 'ignores users that are already channel members' do
      UserChatChannelMembership.create!(user: @user, chat_channel: @channel, following: true)
      Fabricate(:group_user, user: @user, group: chatters_group)

      assert_batches_enqueued(@channel, 0)
    end

    it "queues a batch when the user doesn't follow the channel" do
      UserChatChannelMembership.create!(user: @user, chat_channel: @channel, following: false)
      Fabricate(:group_user, user: @user, group: chatters_group)

      assert_batches_enqueued(@channel, 1)
    end

    it 'queues a batch for channels associated to public categories' do
      public_category = Fabricate(:category)
      @channel.update!(chatable: public_category)

      assert_batches_enqueued(@channel, 1)
    end
  end

  def assert_batches_enqueued(channel, expected)
    expect { subject.execute(chat_channel_id: channel.id) }.to change(Jobs::AutoJoinChannelBatch.jobs, :size).by(expected)
  end
end
