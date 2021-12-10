# frozen_string_literal: true

require 'rails_helper'

describe Jobs::SendChatNotifications do
  # The notification logic for this job is integration tested in ChatMessageCreator and
  # ChatMessageUpdater specs, where jobs are run immediately.
  # Here we are testing if notifications are blocked when users have already read messages,
  # and if new revisions are created in between inqueueing the job and it running.

  fab!(:chat_channel) { Fabricate(:chat_channel) }
  fab!(:user1) { Fabricate(:user) }
  fab!(:user2) { Fabricate(:user) }

  before do
    SiteSetting.chat_enabled = true
    SiteSetting.chat_allowed_groups = Group::AUTO_GROUPS[:everyone]
  end

  it "doesn't send mention notifications if the user has already read the message" do
    chat_message = DiscourseChat::ChatMessageCreator.create(
      chat_channel: chat_channel,
      user: user1,
      content: "Hi @#{user2.username}"
    ).chat_message

    user2.user_chat_channel_memberships.create(
      following: true,
      chat_channel: chat_channel,
      last_read_message_id: chat_message.id
    )

    expect {
      described_class.new.execute(type: :new, chat_message_id: chat_message.id, timestamp: chat_message.created_at)
    }.not_to change { Notification.where(user: user2).count }
  end

  it "doesn't send chat message 'watching' notifications if the user has already read the message" do
    chat_message = DiscourseChat::ChatMessageCreator.create(
      chat_channel: chat_channel,
      user: user1,
      content: "Hi @#{user2.username}"
    ).chat_message

    user2.user_chat_channel_memberships.create(
      following: true,
      chat_channel: chat_channel,
      last_read_message_id: chat_message.id,
      desktop_notification_level: UserChatChannelMembership::NOTIFICATION_LEVELS[:always],
      mobile_notification_level: UserChatChannelMembership::NOTIFICATION_LEVELS[:always],
    )

    PostAlerter.expects(:push_notification).never
    described_class.new.execute(type: :new, chat_message_id: chat_message.id, timestamp: chat_message.created_at)
  end

  it "does nothing if there has been a revision in between enqueueing and running" do
    chat_message = DiscourseChat::ChatMessageCreator.create(
      chat_channel: chat_channel,
      user: user1,
      content: "Hi"
    ).chat_message

    user2.user_chat_channel_memberships.create(
      following: true,
      chat_channel: chat_channel,
      last_read_message_id: nil
    )

    DiscourseChat::ChatMessageUpdater.update(
      chat_message: chat_message,
      new_content: "hi there @#{user2.username}"
    )

    expect {
      described_class.new.execute(type: :new, chat_message_id: chat_message.id, timestamp: chat_message.created_at)
    }.not_to change { Notification.where(user: user2).count }

    # Now run again with the revision timestamp and the user will be notified
    expect {
      described_class.new.execute(type: :new, chat_message_id: chat_message.id, timestamp: chat_message.revisions.last.created_at)
    }.to change { Notification.where(user: user2).count }.by(1)
  end
end
