# frozen_string_literal: true

require 'rails_helper'

describe Jobs::AutoJoinChannelBatch do
  fab!(:chatters_group) { Fabricate(:group) }
  fab!(:category) { Fabricate(:category) }

  before do
    @user = Fabricate(:user, last_seen_at: 15.minutes.ago)
    @channel = Fabricate(:chat_channel, auto_join_users: true, chatable: category)
    @category_group = Fabricate(:category_group, category: category, group: chatters_group)

    chatters_group.add(@user)
  end

  it 'joins all valid users in the batch' do
    subject.execute(chat_channel_id: @channel.id, starts_at: @user.id, ends_at: @user.id)

    new_membership = UserChatChannelMembership.find_by(user: @user, chat_channel: @channel)
    expect(new_membership.following).to eq(true)
  end

  it "doesn't join users outside the batch" do
    another_user = Fabricate(:user)
    chatters_group.add(another_user)

    subject.execute(chat_channel_id: @channel.id, starts_at: @user.id, ends_at: @user.id)

    new_membership = UserChatChannelMembership.find_by(user: another_user, chat_channel: @channel)
    expect(new_membership).to be_nil
  end

  it "doesn't join suspended users" do
    @user.update!(suspended_till: 1.year.from_now)

    subject.execute(chat_channel_id: @channel.id, starts_at: @user.id, ends_at: @user.id)

    new_membership = UserChatChannelMembership.find_by(user: @user, chat_channel: @channel)
    expect(new_membership).to be_nil
  end

  it "doesn't join users last_seen more than 3 months ago" do
    @user.update!(last_seen_at: 4.months.ago)

    subject.execute(chat_channel_id: @channel.id, starts_at: @user.id, ends_at: @user.id)

    new_membership = UserChatChannelMembership.find_by(user: @user, chat_channel: @channel)
    expect(new_membership).to be_nil
  end

  it "only joins group members with access to the category" do
    another_user = Fabricate(:user, last_seen_at: 15.minutes.ago)

    subject.execute(chat_channel_id: @channel.id, starts_at: @user.id, ends_at: another_user.id)

    new_membership = UserChatChannelMembership.find_by(user: another_user, chat_channel: @channel)
    expect(new_membership).to be_nil
  end

  it "works if the user has access through more than one group" do
    second_chatters_group = Fabricate(:group)
    Fabricate(:category_group, category: category, group: second_chatters_group)
    second_chatters_group.add(@user)

    subject.execute(chat_channel_id: @channel.id, starts_at: @user.id, ends_at: @user.id)

    new_membership = UserChatChannelMembership.find_by(user: @user, chat_channel: @channel)
    expect(new_membership.following).to eq(true)
  end

  it 'does nothing if the channel is invalid' do
    subject.execute(chat_channel_id: -1, starts_at: @user.id, ends_at: @user.id)

    memberships = UserChatChannelMembership.where(user: @user)
    expect(memberships).to be_empty
  end

  it 'does nothing if the channel chatable is not a category' do
    same_id = 99
    another_category = Fabricate(:category, id: same_id)
    another_cgroup = Fabricate(:category_group, category: another_category, group: chatters_group)
    topic = Fabricate(:topic, id: same_id)
    @channel.update!(chatable: topic)

    subject.execute(chat_channel_id: @channel.id, starts_at: @user.id, ends_at: @user.id)

    memberships = UserChatChannelMembership.where(user: @user)
    expect(memberships).to be_empty
  end

  it 'updates the channel user_count' do
    initial_count = @channel.user_count

    subject.execute(chat_channel_id: @channel.id, starts_at: @user.id, ends_at: @user.id)

    expect(@channel.reload.user_count).to eq(initial_count + 1)
  end

  it 'ignores users without chat_enabled' do
    @user.user_option.update!(chat_enabled: false)

    subject.execute(chat_channel_id: @channel.id, starts_at: @user.id, ends_at: @user.id)

    memberships = UserChatChannelMembership.where(user: @user)
    expect(memberships).to be_empty
  end

  it 'adds users that were members at some point' do
    UserChatChannelMembership.create!(chat_channel: @channel, user: @user, following: false)

    subject.execute(chat_channel_id: @channel.id, starts_at: @user.id, ends_at: @user.id)

    new_membership = UserChatChannelMembership.find_by(user: @user, chat_channel: @channel)
    expect(new_membership.following).to eq(true)
  end
end
