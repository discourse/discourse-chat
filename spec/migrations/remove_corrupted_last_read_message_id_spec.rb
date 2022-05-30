# frozen_string_literal: true

require 'rails_helper'

describe 'RemoveCorruptedLastReadMessageIdMigration' do
  def run_migration
    ActiveRecord::Migrator.new(
      :up,
      [
        ActiveRecord::MigrationProxy.new('RemoveCorruptedLastReadMessageId', nil, 'plugins/discourse-chat/db/post_migrate/20220526135414_remove_corrupted_last_read_message_id.rb', '')
      ],
      ActiveRecord::SchemaMigration,
      nil
    ).run
  end

  around do |example|
    ActiveRecord::Migration.suppress_messages do
      example.run
    end
  end

  context 'channel of a membership doesn’t exist' do
    fab!(:channel_1) { Fabricate(:chat_channel) }
    fab!(:channel_2) { Fabricate(:chat_channel) }
    fab!(:uccm_1) { Fabricate(:user_chat_channel_membership, chat_channel: channel_1) }
    fab!(:uccm_2) { Fabricate(:user_chat_channel_membership, chat_channel: channel_2) }

    before do
      channel_2.destroy!
    end

    it 'deletes the membership' do
      run_migration

      expect(UserChatChannelMembership.exists?(id: uccm_1.id)).to eq(true)
      expect(ChatChannel.exists?(id: channel_1.id)).to eq(true)
      expect { channel_2.reload }.to raise_error(ActiveRecord::RecordNotFound)
      expect { uccm_2.reload }.to raise_error(ActiveRecord::RecordNotFound)
    end
  end

  context 'message’s channel doesn’t exist' do
    fab!(:channel_1) { Fabricate(:chat_channel) }
    fab!(:channel_2) { Fabricate(:chat_channel) }
    fab!(:message_1) { Fabricate(:chat_message, chat_channel: channel_1) }
    fab!(:message_2) { Fabricate(:chat_message, chat_channel: channel_2) }

    before do
      channel_2.destroy!
    end

    it 'deletes the message' do
      run_migration

      expect(ChatMessage.exists?(id: message_1.id)).to eq(true)
      expect(ChatChannel.exists?(id: channel_1.id)).to eq(true)
      expect { channel_2.reload }.to raise_error(ActiveRecord::RecordNotFound)
      expect { message_2.reload }.to raise_error(ActiveRecord::RecordNotFound)
    end
  end

  context 'last_read_message_id’s message can’t be found' do
    fab!(:channel_1) { Fabricate(:chat_channel) }
    fab!(:channel_2) { Fabricate(:chat_channel) }
    fab!(:message_1) { Fabricate(:chat_message, chat_channel: channel_1) }
    fab!(:message_2) { Fabricate(:chat_message, chat_channel: channel_2) }
    fab!(:message_3) { Fabricate(:chat_message, chat_channel: channel_1) }
    fab!(:uccm_1) { Fabricate(:user_chat_channel_membership, chat_channel: channel_1, last_read_message_id: message_2.id) }
    fab!(:uccm_2) { Fabricate(:user_chat_channel_membership, chat_channel: channel_2, last_read_message_id: message_2.id) }

    it 'resets last_read_message_id to highest message id' do
      run_migration

      expect(uccm_1.last_read_message_id).to eq(message_3.id)
      expect(uccm_2.last_read_message_id).to eq(message_2.id)
    end
  end
end
