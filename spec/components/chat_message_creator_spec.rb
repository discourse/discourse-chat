# frozen_string_literal: true

require 'rails_helper'
require_relative '../fabricators/chat_fabricator'

describe DiscourseChat::ChatMessageCreator do
  fab!(:admin1) { Fabricate(:admin) }
  fab!(:admin2) { Fabricate(:admin) }
  fab!(:user1) { Fabricate(:user, group_ids: [Group::AUTO_GROUPS[:everyone]]) }
  fab!(:user2) { Fabricate(:user) }
  fab!(:user3) { Fabricate(:user) }
  fab!(:user_without_memberships) { Fabricate(:user) }
  fab!(:site_chat_channel) { Fabricate(:site_chat_channel) }
  fab!(:public_chat_channel) { Fabricate(:chat_channel, chatable: Fabricate(:topic)) }
  fab!(:direct_message_channel) { Fabricate(:chat_channel, chatable: Fabricate(:direct_message_channel, users: [user1, user2])) }

  before do
    SiteSetting.topic_chat_enabled = true
    SiteSetting.topic_chat_allowed_groups = Group::AUTO_GROUPS[:everyone]

    # Create channel memberships
    [admin1, admin2].each do |user|
      Fabricate(:user_chat_channel_membership, chat_channel: site_chat_channel, user: user)
    end
    [admin1, admin2, user1, user2, user3].each do |user|
      Fabricate(:user_chat_channel_membership, chat_channel: public_chat_channel, user: user)
    end
    @direct_message_channel = DiscourseChat::DirectMessageChannelCreator.create([user1, user2])
  end

  it "creates messages for users who can see the channel" do
    expect {
      DiscourseChat::ChatMessageCreator.create(
        chat_channel: public_chat_channel,
        user: user1,
        content: "this is a message"
      )
    }.to change { ChatMessage.count }.by(1)
  end

  it "creates mention notifications for public chat" do
    expect {
      DiscourseChat::ChatMessageCreator.create(
        chat_channel: public_chat_channel,
        user: user1,
        content: "this is a @#{user1.username} message with @system @mentions @#{user2.username} and @#{user3.username}"
      )
      # Only 2 mentions are created because user mentioned themselves, system, and an invalid username.
    }.to change { Notification.count }.by(2)
  end

  it "mentions are case insensitive" do
    expect {
      DiscourseChat::ChatMessageCreator.create(
        chat_channel: public_chat_channel,
        user: user1,
        content: "Hey @#{user2.username.upcase}"
      )
    }.to change { Notification.where(user: user2).count }.by(1)
  end

  it "notifies @all properly" do
    expect {
      DiscourseChat::ChatMessageCreator.create(
        chat_channel: public_chat_channel,
        user: user1,
        content: "@all"
      )
    }.to change { Notification.count }.by(4)
  end

  it "notifies @here properly" do
    admin1.update(last_seen_at: 1.year.ago)
    admin2.update(last_seen_at: 1.year.ago)
    user1.update(last_seen_at: Time.now)
    user2.update(last_seen_at: Time.now)
    user3.update(last_seen_at: Time.now)
    expect {
      DiscourseChat::ChatMessageCreator.create(
        chat_channel: public_chat_channel,
        user: user1,
        content: "@here"
      )
    }.to change { Notification.count }.by(2)
  end

  it "doesn't sent double notifications when '@here' is mentioned" do
    user2.update(last_seen_at: Time.now)
    expect {
      DiscourseChat::ChatMessageCreator.create(
        chat_channel: public_chat_channel,
        user: user1,
        content: "@here @#{user2.username}"
      )
    }.to change { Notification.where(user: user2).count }.by(1)
  end

  it "notifies @here plus other mentions" do
    admin1.update(last_seen_at: Time.now)
    admin2.update(last_seen_at: 1.year.ago)
    user1.update(last_seen_at: 1.year.ago)
    user2.update(last_seen_at: 1.year.ago)
    user3.update(last_seen_at: 1.year.ago)
    expect {
      DiscourseChat::ChatMessageCreator.create(
        chat_channel: public_chat_channel,
        user: user1,
        content: "@here plus @#{user3.username}"
      )
    }.to change { Notification.where(user: user3).count }.by(1)
  end

  it "doesn't create mention notifications for users without a membership record" do
    expect {
      DiscourseChat::ChatMessageCreator.create(
        chat_channel: public_chat_channel,
        user: user1,
        content: "hello #{user_without_memberships.username}"
      )
    }.to change { Notification.count }.by(0)
  end

  it "doesn't create mention notifications for users who cannot chat" do
    new_group = Group.create
    SiteSetting.topic_chat_allowed_groups = new_group.id
    expect {
      DiscourseChat::ChatMessageCreator.create(
        chat_channel: public_chat_channel,
        user: user1,
        content: "hi @#{user2.username} @#{user3.username}"
      )
    }.to change { Notification.count }.by(0)
  end

  it "doesn't create mention notifications for users with chat disabled" do
    user2.user_option.update(chat_enabled: false)
    expect {
      DiscourseChat::ChatMessageCreator.create(
        chat_channel: public_chat_channel,
        user: user1,
        content: "hi @#{user2.username}"
      )
    }.to change { Notification.count }.by(0)
  end

  it "created mention notifications only for staff in site channel" do
    expect {
      DiscourseChat::ChatMessageCreator.create(
        chat_channel: site_chat_channel,
        user: admin1,
        content: "Hey @#{admin2.username}, @#{user2.username} and @#{user3.username}"
      )
    }.to change { Notification.count }.by(1)
  end

  it "creates only mention notifications for users with access in private chat " do
    expect {
      DiscourseChat::ChatMessageCreator.create(
        chat_channel: @direct_message_channel,
        user: user1,
        content: "hello there @#{user2.username} and @#{user3.username}"
      )
      # Only user2 should be notified
    }.to change { Notification.count }.by(1)
    expect(Notification.last.user_id).to eq(user2.id)
  end

  it "does not create mentions for suspended users" do
    user2.update(suspended_till: Time.now + 10.years)
    expect {
      DiscourseChat::ChatMessageCreator.create(
        chat_channel: @direct_message_channel,
        user: user1,
        content: "hello @#{user2.username}"
      )
    }.to change { Notification.where(user: user2).count }.by(0)
  end

  describe "push notifications" do
    before do
      UserChatChannelMembership
        .where(user: user1, chat_channel: public_chat_channel)
        .update(mobile_notification_level: UserChatChannelMembership::NOTIFICATION_LEVELS[:always])
      PresenceChannel.clear_all!
    end

    it "sends a push notification to watching users who are not in chat" do
      PostAlerter.expects(:push_notification).once
      DiscourseChat::ChatMessageCreator.create(
        chat_channel: public_chat_channel,
        user: user2,
        content: "Beep boop"
      )
    end

    it "does not send a push notification to watching users who are in chat" do
      PresenceChannel.new("/chat/online").present(user_id: user1.id, client_id: 1)
      PostAlerter.expects(:push_notification).never
      DiscourseChat::ChatMessageCreator.create(
        chat_channel: public_chat_channel,
        user: user2,
        content: "Beep boop"
      )
    end
  end
end
