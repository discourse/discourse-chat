# frozen_string_literal: true

class RemoveCorruptedLastReadMessageId < ActiveRecord::Migration[7.0]
  def change
    # Delete memberships for deleted channels
    execute <<~SQL
      DELETE FROM user_chat_channel_memberships uccm
      WHERE NOT EXISTS (
        SELECT FROM chat_channels cc
        WHERE cc.id = uccm.chat_channel_id
      );
    SQL

    # Delete messages for deleted channels
    execute <<~SQL
      DELETE FROM chat_messages cm
      WHERE NOT EXISTS (
        SELECT FROM chat_channels cc
        WHERE cc.id = cm.chat_channel_id
      );
    SQL

    # Reset highest_channel_message_id if the message cannot be found in the channel
    execute <<~SQL
      WITH highest_channel_message_id AS (
        SELECT chat_channel_id, max(chat_messages.id) as highest_id
        FROM chat_messages
        GROUP BY chat_channel_id
      )
      UPDATE user_chat_channel_memberships uccm
      SET last_read_message_id = highest_channel_message_id.highest_id
      FROM highest_channel_message_id
      WHERE highest_channel_message_id.chat_channel_id = uccm.chat_channel_id
      AND uccm.last_read_message_id IS NOT NULL
      AND uccm.last_read_message_id NOT IN (
        SELECT id FROM chat_messages WHERE chat_messages.chat_channel_id = uccm.chat_channel_id
      )
    SQL
  end
end
