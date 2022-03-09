# frozen_string_literal: true

class AddUserCountToChatChannel < ActiveRecord::Migration[6.1]
  def change
    add_column :chat_channels, :user_count, :integer, null: true
  end
end
