# frozen_string_literal: true

class ChangeChatChannelsTimestampColumnsToTimestampType < ActiveRecord::Migration[6.1]
  def change
    change_column_default :chat_channels, :created_at, nil
    change_column_default :chat_channels, :updated_at, nil
    change_column :chat_channels, :created_at, :timestamp
    change_column :chat_channels, :updated_at, :timestamp
  end
end
