# frozen_string_literal: true
#
class CreateChatChannelArchiveTable < ActiveRecord::Migration[6.1]
  def change
    create_table :chat_channel_archives do |t|
      t.references :chat_channel, null: false
      t.integer :archived_by_id, null: false
      t.integer :destination_topic_id
      t.string :destination_topic_title
      t.integer :destination_category_id
      t.column :destination_tags, :string, array: true
      t.integer :total_messages, null: false
      t.integer :archived_messages, default: 0, null: false

      t.timestamps
    end
  end
end
