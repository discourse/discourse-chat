# frozen_string_literal: true

require 'rails_helper'
require_relative '../fabricators/chat_channel_fabricator'

describe DiscourseChat::ChatMessageUpdater do
  fab!(:user) { Fabricate(:user) }
  fab!(:second_user) { Fabricate(:user) }
  fab!(:third_user) { Fabricate(:user) }
  fab!(:fourth_user) { Fabricate(:user) }
  fab!(:topic) { Fabricate(:topic) }
  fab!(:chat_channel) { Fabricate(:chat_channel, chatable: topic) }

  def create_chat_message(message)
    creator = DiscourseChat::ChatMessageCreator.create(
      chat_channel: chat_channel,
      user: user,
      in_reply_to_id: nil,
      content: message,
    )
    creator.chat_message
  end

  it "it updates a messages content" do
    chat_message = create_chat_message("This will be changed")
    new_message = "Change to this!"

    DiscourseChat::ChatMessageUpdater.update(
      chat_message: chat_message,
      new_content: new_message
    )
    expect(chat_message.reload.message).to eq(new_message)
  end

  it "creates mention notifications for unmentioned users" do
    chat_message = create_chat_message("This will be changed")
    expect {
      DiscourseChat::ChatMessageUpdater.update(
        chat_message: chat_message,
        new_content: "this is a message with @system @mentions @#{second_user.username} and @#{third_user.username}"
      )
    }.to change { Notification.count }.by(2)
  end

  it "doesn't create mentions for already mentioned users" do
    message = "ping @#{second_user.username} @#{third_user.username}"
    chat_message = create_chat_message(message)
    expect {
      DiscourseChat::ChatMessageUpdater.update(
        chat_message: chat_message,
        new_content: message + " editedddd"
      )
    }.to change { Notification.count }.by(0)
  end

  it "destroys mention notifications that should be removed" do
    chat_message = create_chat_message("ping @#{second_user.username} @#{third_user.username}")
    expect {
      DiscourseChat::ChatMessageUpdater.update(
        chat_message: chat_message,
        new_content: "ping @#{third_user.username}"
      )
    }.to change { Notification.count }.by(-1)
  end

  it "creates new, leaves existing, and removes old mentions all at once" do
    chat_message = create_chat_message("ping @#{second_user.username} @#{third_user.username}")
    DiscourseChat::ChatMessageUpdater.update(
      chat_message: chat_message,
      new_content: "ping @#{third_user.username} @#{fourth_user.username}"
    )

    expect(
      Notification
      .where(notification_type: Notification.types[:chat_mention])
      .where(user_id: second_user)
      .where("data LIKE ?", "%\"chat_message_id\":#{chat_message.id}%")
    ).not_to be_present

    expect(
      Notification
      .where(notification_type: Notification.types[:chat_mention])
      .where(user_id: third_user)
      .where("data LIKE ?", "%\"chat_message_id\":#{chat_message.id}%")
    ).to be_present

    expect(
      Notification
      .where(notification_type: Notification.types[:chat_mention])
      .where(user_id: fourth_user)
      .where("data LIKE ?", "%\"chat_message_id\":#{chat_message.id}%")
    ).to be_present
  end
end
