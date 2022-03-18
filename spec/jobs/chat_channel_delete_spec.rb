# frozen_string_literal: true

describe Jobs::ChatChannelDelete do
  fab!(:chat_channel) { Fabricate(:chat_channel) }
  fab!(:user1) { Fabricate(:user) }
  fab!(:user2) { Fabricate(:user) }
  fab!(:user3) { Fabricate(:user) }
  let(:users) { [user1, user2, user3] }

  before do
    messages = []
    20.times do
      messages << Fabricate(:chat_message, chat_channel: chat_channel, user: users.sample)
    end
    @message_ids = messages.map(&:id)

    10.times do
      ChatMessageReaction.create(chat_message: messages.sample, user: users.sample)
    end

    10.times do
      ChatUpload.create(upload: Fabricate(:upload, user: users.sample), chat_message: messages.sample)
    end

    ChatMention.create(
      user: user2,
      chat_message: messages.sample,
      notification: Fabricate(:notification)
    )

    @incoming_chat_webhook_id = Fabricate(:incoming_chat_webhook, chat_channel: chat_channel)
    ChatWebhookEvent.create(
      incoming_chat_webhook: @incoming_chat_webhook_id,
      chat_message: messages.sample
    )

    revision_message = messages.sample
    ChatMessageRevision.create(
      chat_message: revision_message,
      old_message: "some old message",
      new_message: revision_message.message
    )

    ChatDraft.create(chat_channel: chat_channel, user: users.sample, data: "wow some draft")

    Fabricate(:user_chat_channel_membership, chat_channel: chat_channel, user: user1)
    Fabricate(:user_chat_channel_membership, chat_channel: chat_channel, user: user2)
    Fabricate(:user_chat_channel_membership, chat_channel: chat_channel, user: user3)

    chat_channel.trash!
  end

  it "deletes all of the messages and related records completely" do
    described_class.new.execute(chat_channel_id: chat_channel.id)
    expect(IncomingChatWebhook.where(chat_channel_id: chat_channel.id).count).to eq(0)
    expect(ChatWebhookEvent.where(incoming_chat_webhook_id: @incoming_chat_webhook_id).count).to eq(0)
    expect(ChatDraft.where(chat_channel: chat_channel).count).to eq(0)
    expect(UserChatChannelMembership.where(chat_channel: chat_channel).count).to eq(0)
    expect(ChatMessageRevision.where(chat_message_id: @message_ids).count).to eq(0)
    expect(ChatMention.where(chat_message_id: @message_ids).count).to eq(0)
    expect(ChatUpload.where(chat_message_id: @message_ids).count).to eq(0)
    expect(ChatMessage.where(id: @message_ids).count).to eq(0)
  end
end
