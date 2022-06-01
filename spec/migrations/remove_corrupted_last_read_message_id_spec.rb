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

  context 'message doesn’t exist' do
    context 'in reply to' do
      fab!(:message_1) { Fabricate(:chat_message) }
      fab!(:message_2) { Fabricate(:chat_message, in_reply_to_id: message_1.id) }
      fab!(:message_3) { Fabricate(:chat_message, in_reply_to_id: message_2.id) }

      it 'nullifies relationship key to this message' do
        expect(message_2.in_reply_to_id).to eq(message_1.id)

        message_1.delete
        run_migration

        expect(message_3.reload.in_reply_to_id).to eq(message_2.id)
        expect(message_2.reload.in_reply_to_id).to be_nil
      end
    end

    context 'revisions' do
      fab!(:message_1) { Fabricate(:chat_message) }
      fab!(:message_2) { Fabricate(:chat_message) }
      fab!(:revision_1) { Fabricate(:chat_message_revision, chat_message: message_1) }
      fab!(:revision_2) { Fabricate(:chat_message_revision, chat_message: message_2) }

      it 'destroys revisions of this message' do
        message_1.delete

        run_migration

        expect { revision_1.reload }.to raise_error(ActiveRecord::RecordNotFound)
        expect { revision_2.reload }.not_to raise_error
      end
    end

    context 'reactions' do
      fab!(:message_1) { Fabricate(:chat_message) }
      fab!(:message_2) { Fabricate(:chat_message) }
      fab!(:reaction_1) { Fabricate(:chat_message_reaction, chat_message: message_1) }
      fab!(:reaction_2) { Fabricate(:chat_message_reaction, chat_message: message_2) }

      it 'destroys reactions of this message' do
        message_1.delete

        run_migration

        expect { reaction_1.reload }.to raise_error(ActiveRecord::RecordNotFound)
        expect { reaction_2.reload }.not_to raise_error
      end
    end

    context 'bookmarks' do
      before do
        Bookmark.register_bookmarkable(ChatMessageBookmarkable)
      end

      fab!(:message_1) { Fabricate(:chat_message) }
      fab!(:message_2) { Fabricate(:chat_message) }
      let!(:bookmark_1) { Fabricate(:bookmark, bookmarkable: message_1) }
      let!(:bookmark_2) { Fabricate(:bookmark, bookmarkable: message_2) }

      it 'destroys ChatMessage bookmarks of this message' do
        message_1.delete

        run_migration

        expect { bookmark_1.reload }.to raise_error(ActiveRecord::RecordNotFound)
        expect { bookmark_2.reload }.not_to raise_error
      end
    end

    context 'mentions' do
      fab!(:message_1) { Fabricate(:chat_message) }
      fab!(:message_2) { Fabricate(:chat_message) }
      fab!(:mention_1) { Fabricate(:chat_mention, chat_message: message_1) }
      fab!(:mention_2) { Fabricate(:chat_mention, chat_message: message_2) }

      it 'destroys mentions of this message' do
        message_1.delete

        run_migration

        expect { mention_1.reload }.to raise_error(ActiveRecord::RecordNotFound)
        expect { mention_2.reload }.not_to raise_error
      end
    end

    context 'chat_webhook_events' do
      fab!(:message_1) { Fabricate(:chat_message) }
      fab!(:message_2) { Fabricate(:chat_message) }
      fab!(:webhook_1) { Fabricate(:chat_webhook_event, chat_message: message_1) }
      fab!(:webhook_2) { Fabricate(:chat_webhook_event, chat_message: message_2) }

      it 'destroys chat_webhook_events of this message' do
        message_1.delete

        run_migration

        expect { webhook_1.reload }.to raise_error(ActiveRecord::RecordNotFound)
        expect { webhook_2.reload }.not_to raise_error
      end
    end

    context 'chat_uploads' do
      fab!(:message_1) { Fabricate(:chat_message) }
      fab!(:message_2) { Fabricate(:chat_message) }
      fab!(:chat_upload_1) { Fabricate(:chat_upload, chat_message: message_1) }
      fab!(:chat_upload_2) { Fabricate(:chat_upload, chat_message: message_2) }

      it 'destroys uploads and chat_uploads of this message' do
        message_1.delete

        run_migration

        expect { chat_upload_1.reload }.to raise_error(ActiveRecord::RecordNotFound)
        expect { chat_upload_2.reload }.not_to raise_error
      end
    end
  end
end
