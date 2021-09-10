# frozen_string_literal: true

require 'rails_helper'
require_relative '../fabricators/chat_fabricator'

describe DiscourseChat::ChatMessageUpdater do
  fab!(:admin1) { Fabricate(:admin) }
  fab!(:admin2) { Fabricate(:admin) }
  fab!(:user1) { Fabricate(:user) }
  fab!(:user2) { Fabricate(:user) }
  fab!(:user3) { Fabricate(:user) }
  fab!(:user4) { Fabricate(:user) }
  fab!(:public_chat_channel) { Fabricate(:chat_channel, chatable: Fabricate(:topic)) }
  fab!(:site_chat_channel) { Fabricate(:site_chat_channel) }

  before do
    SiteSetting.topic_chat_enabled = true
    SiteSetting.topic_chat_restrict_to_staff = false

    [admin1, admin2].each do |user|
      Fabricate(:user_chat_channel_membership, chat_channel: site_chat_channel, user: user)
    end
    [admin1, admin2, user1, user2, user3, user4].each do |user|
      Fabricate(:user_chat_channel_membership, chat_channel: public_chat_channel, user: user)
    end
    @direct_message_channel = DiscourseChat::DirectMessageChannelCreator.create([user1, user2])
  end

  def create_chat_message(user, message, channel)
    creator = DiscourseChat::ChatMessageCreator.create(
      chat_channel: channel,
      user: user,
      in_reply_to_id: nil,
      content: message,
    )
    creator.chat_message
  end

  it "it updates a messages content" do
    chat_message = create_chat_message(user1, "This will be changed", public_chat_channel)
    new_message = "Change to this!"

    DiscourseChat::ChatMessageUpdater.update(
      chat_message: chat_message,
      new_content: new_message
    )
    expect(chat_message.reload.message).to eq(new_message)
  end

  it "creates mention notifications for unmentioned users" do
    chat_message = create_chat_message(user1, "This will be changed", public_chat_channel)
    expect {
      DiscourseChat::ChatMessageUpdater.update(
        chat_message: chat_message,
        new_content: "this is a message with @system @mentions @#{user2.username} and @#{user3.username}"
      )
    }.to change { Notification.count }.by(2)
  end

  it "doesn't create mentions for already mentioned users" do
    message = "ping @#{user2.username} @#{user3.username}"
    chat_message = create_chat_message(user1, message, public_chat_channel)
    expect {
      DiscourseChat::ChatMessageUpdater.update(
        chat_message: chat_message,
        new_content: message + " editedddd"
      )
    }.to change { Notification.count }.by(0)
  end

  it "doesn't create mentions for users without access" do

  end

  it "destroys mention notifications that should be removed" do
    chat_message = create_chat_message(user1, "ping @#{user2.username} @#{user3.username}", public_chat_channel)
    expect {
      DiscourseChat::ChatMessageUpdater.update(
        chat_message: chat_message,
        new_content: "ping @#{user3.username}"
      )
    }.to change { Notification.count }.by(-1)
  end

  it "creates new, leaves existing, and removes old mentions all at once" do
    chat_message = create_chat_message(user1, "ping @#{user2.username} @#{user3.username}", public_chat_channel)
    DiscourseChat::ChatMessageUpdater.update(
      chat_message: chat_message,
      new_content: "ping @#{user3.username} @#{user4.username}"
    )

    expect(
      Notification
      .where(notification_type: Notification.types[:chat_mention])
      .where(user_id: user2)
      .where("data LIKE ?", "%\"chat_message_id\":#{chat_message.id}%")
    ).not_to be_present

    expect(
      Notification
      .where(notification_type: Notification.types[:chat_mention])
      .where(user_id: user3)
      .where("data LIKE ?", "%\"chat_message_id\":#{chat_message.id}%")
    ).to be_present

    expect(
      Notification
      .where(notification_type: Notification.types[:chat_mention])
      .where(user_id: user4)
      .where("data LIKE ?", "%\"chat_message_id\":#{chat_message.id}%")
    ).to be_present
  end

  it "does not create new mentions in staff chat for regular users" do
    chat_message = create_chat_message(admin1, "ping nobody" , site_chat_channel)
    expect {
      DiscourseChat::ChatMessageUpdater.update(
        chat_message: chat_message,
        new_content: "ping @#{admin2.username} @#{user3.username} @#{user4.username}"
      )
    }.to change { Notification.count }.by(1)
    expect(Notification.last.user_id).to eq(admin2.id)
  end

  it "does not create new mentions in direct message for users who don't have access" do
    chat_message = create_chat_message(user1, "ping nobody" , @direct_message_channel)
    expect {
      DiscourseChat::ChatMessageUpdater.update(
        chat_message: chat_message,
        new_content: "ping @#{admin1.username}"
      )
    }.to change { Notification.count }.by(0)
  end

  it "creates a chat_message_revision record" do
    old_message = "It's a thrsday!"
    new_message = "It's a thursday!"
    chat_message = create_chat_message(user1, old_message, public_chat_channel)
    DiscourseChat::ChatMessageUpdater.update(
      chat_message: chat_message,
      new_content: new_message
    )
    revision = chat_message.revisions.last
    expect(revision.old_message).to eq(old_message)
    expect(revision.new_message).to eq(new_message)
  end
end
