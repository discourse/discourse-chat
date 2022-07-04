# frozen_string_literal: true

require 'rails_helper'

describe Jobs::AutoJoinChannel do
  fab!(:chatters_group) { Fabricate(:group) }
  fab!(:category) { Fabricate(:category) }

  before do
    @user = Fabricate(:user, last_seen_at: 15.minutes.ago)
    @channel = Fabricate(:chat_channel, chatable: category)
    @category_group = Fabricate(:category_group, category: category, group: chatters_group)
  end

  it 'queues a batch for users with channel access' do
    chatters_group.add(@user)

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
    another_category = Fabricate(:category, id: same_id)
    another_cgroup = Fabricate(:category_group, category: another_category, group: chatters_group)
    topic = Fabricate(:topic, id: same_id)
    chatters_group.add(@user)
    @channel.update!(chatable: topic)

    assert_batches_enqueued(@channel, 0)
  end

  it 'excludes users not seen in the last 3 months' do
    chatters_group.add(@user)
    @user.update!(last_seen_at: 3.months.ago)

    assert_batches_enqueued(@channel, 0)
  end

  it 'excludes users without chat enabled' do
    chatters_group.add(@user)
    @user.user_option.update!(chat_enabled: false)

    assert_batches_enqueued(@channel, 0)
  end

  it 'respects the max_chat_auto_joined_users setting' do
    SiteSetting.max_chat_auto_joined_users = 0
    chatters_group.add(@user)

    assert_batches_enqueued(@channel, 0)
  end

  it 'ignores users that are already channel members' do
    UserChatChannelMembership.create!(user: @user, chat_channel: @channel, following: true)
    chatters_group.add(@user)

    assert_batches_enqueued(@channel, 0)
  end

  it "queues a batch when the user doesn't follow the channel" do
    UserChatChannelMembership.create!(user: @user, chat_channel: @channel, following: false)
    chatters_group.add(@user)

    assert_batches_enqueued(@channel, 1)
  end

  def assert_batches_enqueued(channel, expected)
    expect { subject.execute(chat_channel_id: channel.id) }.to change(Jobs::AutoJoinChannelBatch.jobs, :size).by(expected)
  end
end
