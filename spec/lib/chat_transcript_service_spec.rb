# frozen_string_literal: true

require 'rails_helper'

describe ChatTranscriptService do
  let(:user1) { Fabricate(:user, username: "martinchat") }
  let(:user2) { Fabricate(:user, username: "brucechat") }
  let(:channel) { Fabricate(:chat_channel, name: "The Beam Discussions") }

  def service(message_ids)
    described_class.new(channel, Array.wrap(message_ids))
  end

  it "generates a simple chat transcript from one message" do
    message = Fabricate(:chat_message, user: user1, chat_channel: channel, message: "an extremely insightful response :)")

    expect(service(message.id).generate_bbcode).to eq(<<~MARKDOWN)
    [chat quote="martinchat;#{message.id};#{message.created_at.iso8601}" channel="The Beam Discussions"]
    an extremely insightful response :)
    [/chat]
    MARKDOWN
  end

  it "generates a single chat transcript from multiple subsequent messages from the same user" do
    message1 = Fabricate(:chat_message, user: user1, chat_channel: channel, message: "an extremely insightful response :)")
    message2 = Fabricate(:chat_message, user: user1, chat_channel: channel, message: "if i say so myself")
    message3 = Fabricate(:chat_message, user: user1, chat_channel: channel, message: "yay!")

    rendered = service([message1.id, message2.id, message3.id]).generate_bbcode
    expect(rendered).to eq(<<~MARKDOWN)
    [chat quote="martinchat;#{message1.id};#{message1.created_at.iso8601}" channel="The Beam Discussions" multiQuote="true"]
    an extremely insightful response :)

    if i say so myself

    yay!
    [/chat]
    MARKDOWN
  end

  it "generates multiple chained chat transcripts for interleaving messages from different users" do
    message1 = Fabricate(:chat_message, user: user1, chat_channel: channel, message: "an extremely insightful response :)")
    message2 = Fabricate(:chat_message, user: user2, chat_channel: channel, message: "says you!")
    message3 = Fabricate(:chat_message, user: user1, chat_channel: channel, message: "aw :(")

    expect(service([message1.id, message2.id, message3.id]).generate_bbcode).to eq(<<~MARKDOWN)
    [chat quote="martinchat;#{message1.id};#{message1.created_at.iso8601}" channel="The Beam Discussions" multiQuote="true" chained="true"]
    an extremely insightful response :)
    [/chat]

    [chat quote="brucechat;#{message2.id};#{message2.created_at.iso8601}" chained="true"]
    says you!
    [/chat]

    [chat quote="martinchat;#{message3.id};#{message1.created_at.iso8601}" chained="true"]
    aw :(
    [/chat]
    MARKDOWN
  end
end
