# frozen_string_literal: true
class AddTimestampsToChatChannels < ActiveRecord::Migration[6.1]
  def change
    add_column :chat_channels, :created_at, :timestamp, null: false
    add_column :chat_channels, :updated_at, :timestamp, null: false
  end
end
