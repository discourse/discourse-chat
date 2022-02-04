# frozen_string_literal: true

class CreateChatFlags < ActiveRecord::Migration[6.1]
  def change
    create_table :chat_message_flags do |t|
      t.integer :chat_message_id, null: false
      t.integer :user_id, null: false
      t.integer :reviewable_id, null: true
      t.timestamps
    end

    add_index :chat_message_flags,
      [:chat_message_id, :user_id, :reviewable_id],
      unique: true,
      name: "chat_message_flags_index"
  end
end
