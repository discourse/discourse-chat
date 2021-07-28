# frozen_string_literal: true

require 'rails_helper'
require_relative '../fabricators/chat_fabricator'

describe DiscourseChat::ChatMessageCreator do
  fab!(:topic) { Fabricate(:topic) }
  fab!(:chat_channel) { Fabricate(:chat_channel, chatable: topic) }
  fab!(:user) { Fabricate(:user) }
  fab!(:second_user) { Fabricate(:user) }
  fab!(:third_user) { Fabricate(:user) }

  it "it creates messages" do
    expect {
      DiscourseChat::ChatMessageCreator.create(
        chat_channel: chat_channel,
        user: user,
        in_reply_to_id: nil,
        content: "this is a message"
      )
    }.to change { ChatMessage.count }.by(1)
  end

  it "creates mention notifications" do
    expect {
      DiscourseChat::ChatMessageCreator.create(
        chat_channel: chat_channel,
        user: user,
        in_reply_to_id: nil,
        content: "this is a @#{user.username} message with @system @mentions @#{second_user.username} and @#{third_user.username}"
      )
      # Only 2 mentions are created because user mentioned themselves, system, and an invalid username.
    }.to change { Notification.count }.by(2)
  end
end
