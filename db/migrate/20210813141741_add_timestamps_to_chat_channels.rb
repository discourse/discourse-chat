# frozen_string_literal: true
class AddTimestampsToChatChannels < ActiveRecord::Migration[6.1]
  def change
    add_column :chat_channels, :created_at, :datetime, null: false, default: Time.now
    add_column :chat_channels, :updated_at, :datetime, null: false, default: Time.now
  end
end
