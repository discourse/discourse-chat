# frozen_string_literal: true

require 'rails_helper'

describe ChatMessageMoveService do
  fab!(:acting_user) { Fabricate(:admin, username: "testmovechat") }
  fab!(:source_channel) { Fabricate(:chat_channel) }
  fab!(:destination_channel) { Fabricate(:chat_channel) }

  let!(:message1) { Fabricate(:chat_message, chat_channel: source_channel, message: "the first to be moved") }
  let!(:message2) { Fabricate(:chat_message, chat_channel: source_channel, message: "message deux @testmovechat") }
  let!(:message3) { Fabricate(:chat_message, chat_channel: source_channel, message: "the third message") }
  let!(:message4) { Fabricate(:chat_message, chat_channel: destination_channel) }
  let!(:message5) { Fabricate(:chat_message, chat_channel: destination_channel) }
  let!(:message6) { Fabricate(:chat_message, chat_channel: destination_channel) }
  let(:move_message_ids) { [message1.id, message2.id, message3.id] }

  subject do
    described_class.new(
      acting_user: acting_user,
      source_channel: source_channel,
      message_ids: move_message_ids
    )
  end

  describe "#move_to_channel" do
    def move!
      subject.move_to_channel(destination_channel)
    end

    it "raises an error if either the source or destination channels are not public (they cannot be DM channels)" do
      expect {
        described_class.new(
          acting_user: acting_user,
          source_channel: Fabricate(:chat_channel, chatable: Fabricate(:direct_message_channel)),
          message_ids: move_message_ids
        ).move_to_channel(destination_channel)
      }.to raise_error(ChatMessageMoveService::InvalidChannel)
      expect {
        described_class.new(
          acting_user: acting_user,
          source_channel: source_channel,
          message_ids: move_message_ids
        ).move_to_channel(Fabricate(:chat_channel, chatable: Fabricate(:direct_message_channel)))
      }.to raise_error(ChatMessageMoveService::InvalidChannel)
    end

    it "raises an error if no messages are found using the message ids" do
      other_channel = Fabricate(:chat_channel)
      message1.update(chat_channel: other_channel)
      message2.update(chat_channel: other_channel)
      message3.update(chat_channel: other_channel)
      expect { move! }.to raise_error(ChatMessageMoveService::NoMessagesFound)
    end

    it "deletes the messages from the source channel" do
      move!
      expect(ChatMessage.where(id: move_message_ids)).to eq([])
      expect(ChatMessage.with_deleted.where(id: move_message_ids).count).to eq(3)
    end

    it "creates a message in the source channel to indicate that the messages have been moved" do
      move!
      placeholder_message = ChatMessage.where(chat_channel: source_channel).order(:created_at).last
      destination_first_moved_message = ChatMessage.find_by(chat_channel: destination_channel, message: "the first to be moved")
      expect(placeholder_message.message).to eq(
        I18n.t(
          "chat.channel.messages_moved",
          count: move_message_ids.length,
          acting_username: acting_user.username,
          channel_name: destination_channel.name,
          first_moved_message_url: destination_first_moved_message.url
        )
      )
    end

    it "preserves the order of the messages in the destination channel" do
      move!
      moved_messages = ChatMessage.where(chat_channel: destination_channel).order("created_at ASC").last(3)
      expect(moved_messages.map(&:message)).to eq([
        "the first to be moved",
        "message deux @testmovechat",
        "the third message"
      ])
    end

    it "updates references for reactions, uploads, revisions, mentions, etc." do
      reaction = Fabricate(:chat_message_reaction, chat_message: message1)
      upload = Fabricate(:chat_upload, chat_message: message1)
      mention = Fabricate(:chat_mention, chat_message: message2, user: acting_user)
      revision = Fabricate(:chat_message_revision, chat_message: message3)
      webhook_event = Fabricate(:chat_webhook_event, chat_message: message3)
      move!

      moved_messages = ChatMessage.where(chat_channel: destination_channel).order(:created_at).last(3)
      expect(reaction.reload.chat_message_id).to eq(moved_messages.first.id)
      expect(upload.reload.chat_message_id).to eq(moved_messages.first.id)
      expect(mention.reload.chat_message_id).to eq(moved_messages.second.id)
      expect(revision.reload.chat_message_id).to eq(moved_messages.third.id)
      expect(webhook_event.reload.chat_message_id).to eq(moved_messages.third.id)
    end
  end
end
