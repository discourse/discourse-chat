# frozen_string_literal: true

require 'rails_helper'
require_relative '../fabricators/chat_fabricator'

describe DiscourseChat::ChatMessageCreator do
  fab!(:admin1) { Fabricate(:admin) }
  fab!(:admin2) { Fabricate(:admin) }
  fab!(:user1) { Fabricate(:admin) }
  fab!(:user2) { Fabricate(:user) }
  fab!(:user3) { Fabricate(:user) }
  fab!(:site_chat_channel) { Fabricate(:site_chat_channel) }
  fab!(:topic_chat_channel) { Fabricate(:chat_channel, chatable: Fabricate(:topic)) }
  fab!(:direct_message_channel) { Fabricate(:chat_channel, chatable: Fabricate(:direct_message_channel, users: [user1, user2])) }

  before do
    SiteSetting.topic_chat_enabled = true
    SiteSetting.topic_chat_restrict_to_staff = false
  end

  it "it creates messages for users who can see the channel" do
    expect {
      DiscourseChat::ChatMessageCreator.create(
        chat_channel: topic_chat_channel,
        user: user1,
        in_reply_to_id: nil,
        content: "this is a message"
      )
    }.to change { ChatMessage.count }.by(1)
  end

  it "creates mention notifications for public chat" do
    expect {
      DiscourseChat::ChatMessageCreator.create(
        chat_channel: topic_chat_channel,
        user: user1,
        in_reply_to_id: nil,
        content: "this is a @#{user1.username} message with @system @mentions @#{user2.username} and @#{user3.username}"
      )
      # Only 2 mentions are created because user mentioned themselves, system, and an invalid username.
    }.to change { Notification.count }.by(2)
  end

  it "created mention notifications only for staff in site channel" do
    expect {
      DiscourseChat::ChatMessageCreator.create(
        chat_channel: site_chat_channel,
        user: admin1,
        in_reply_to_id: nil,
        content: "Hey @#{admin2.username}, @#{user2.username} and @#{user3.username}"
      )
    }.to change { Notification.count }.by(1)
  end

  it "creates only mention notifications for users with access in private chat " do
    expect {
      DiscourseChat::ChatMessageCreator.create(
        chat_channel: direct_message_channel,
        user: user1,
        in_reply_to_id: nil,
        content: "hello there @#{user2.username} and @#{user3.username}"
      )
      # Only user2 should be notified
    }.to change { Notification.count }.by(1)
    expect(Notification.last.user_id).to eq(user2.id)
  end
end
