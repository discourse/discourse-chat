# frozen_string_literal: true

class CreateChatFlags < ActiveRecord::Migration[6.1]
  def change
    create_table :chat_message_flags do |t|
      t.integer :chat_message_id, null: false
      t.integer :user_id, null: false
      t.integer :post_action_type_id, null: false
      t.timestamps
    end
  end
end
