# frozen_string_literal: true

class CreateChatTables < ActiveRecord::Migration[6.0]
  def change
    create_table :topic_chats do |t|
      t.integer :topic_id
      t.datetime :deleted_at, null: true
      t.integer :deleted_by_id, null: true

      t.integer :featured_in_category_id
      t.integer :delete_after_seconds, default: nil
    end
    
    create_table :topic_chat_messages do |t|
      t.integer :topic_id, null: false
      t.integer :post_id, null: false
      t.integer :user_id, null: true
      t.timestamps
      t.datetime :deleted_at, null: true
      t.integer :deleted_by_id, null: true
      t.integer :in_reply_to_id, null: true
      t.text :message
    end
  end
end
