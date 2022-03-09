# frozen_string_literal: true

class AddUserCountToChatChannel < ActiveRecord::Migration[6.1]
  def change
    add_column :chat_channels, :user_count, :integer, null: true, default: 0

    execute <<~SQL
      UPDATE chat_channels
      SET user_count = 0;
    SQL

    change_column_null :chat_channels, :user_count, false
  end
end
