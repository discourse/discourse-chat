# frozen_string_literal: true

class CreateChatMessageRevisions < ActiveRecord::Migration[6.1]
  def change
    create_table :chat_message_revisions do |t|
      t.integer :chat_message_id
      t.text :old_message
      t.text :new_message
      t.timestamps
    end
  end
end
