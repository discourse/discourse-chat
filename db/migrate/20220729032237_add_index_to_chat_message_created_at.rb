# frozen_string_literal: true

class AddIndexToChatMessageCreatedAt < ActiveRecord::Migration[7.0]
  disable_ddl_transaction!

  def change
    add_index :chat_messages, :created_at, algorithm: :concurrently
  end
end
