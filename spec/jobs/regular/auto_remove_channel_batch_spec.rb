# frozen_string_literal: true

require 'rails_helper'

describe Jobs::AutoRemoveChannelBatch do
  fab!(:chatters_group) { Fabricate(:group) }
  fab!(:category) { Fabricate(:category) }

  before do
    @user = Fabricate(:user, last_seen_at: 15.minutes.ago)
    @channel = Fabricate(:chat_channel, auto_join_users: true, chatable: category)

    chatters_group.add(@user)
    @channel.join(@user)
  end

  it 'removes all valid users in the batch' do
    subject.execute(chat_channel_id: @channel.id, starts_at: @user.id, ends_at: @user.id)

    membership = UserChatChannelMembership.find_by(user: @user, chat_channel: @channel)
    expect(membership.following).to eq(false)
  end

  it "doesn't remove the user from other channels" do
    another_channel = Fabricate(:chat_channel)
    another_channel.join(@user)

    subject.execute(chat_channel_id: @channel.id, starts_at: @user.id, ends_at: @user.id)

    another_membership = UserChatChannelMembership.find_by(user: @user, chat_channel: another_channel)
    expect(another_membership.following).to eq(true)
  end

  it "doesn't remove users outside the interval" do
    another_user = Fabricate(:user)
    @channel.join(another_user)

    subject.execute(chat_channel_id: @channel.id, starts_at: @user.id, ends_at: @user.id)

    another_membership = UserChatChannelMembership.find_by(user: another_user, chat_channel: @channel)
    expect(another_membership.following).to eq(true)
  end

  it "doesn't remove users if they still have access through a different group" do
    another_group = Fabricate(:group)
    Fabricate(:group_user, user: @user, group: another_group)
    Fabricate(:category_group, category: category, group: another_group)

    subject.execute(chat_channel_id: @channel.id, starts_at: @user.id, ends_at: @user.id)

    another_membership = UserChatChannelMembership.find_by(user: @user, chat_channel: @channel)
    expect(another_membership.following).to eq(true)
  end

  it 'decreases the channel user count' do
    initial_count = @channel.user_count

    subject.execute(chat_channel_id: @channel.id, starts_at: @user.id, ends_at: @user.id)

    expect(@channel.reload.user_count).to eq(initial_count - 1)
  end
end
