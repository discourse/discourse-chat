# frozen_string_literal: true

require 'rails_helper'

describe Jobs::SendChatNotifications do
  # General spec for this job are found in ChatMessageCreator and ChatMessageUpdater specs.
  # Here we are just testing the delay, to make sure unnecissary notifications don't go out.

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
      described_class.new.execute(type: :new, chat_message_id: chat_message.id)
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
    described_class.new.execute(type: :new, chat_message_id: chat_message.id)
  end
end
