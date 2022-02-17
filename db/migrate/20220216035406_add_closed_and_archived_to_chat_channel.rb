# frozen_string_literal: true

class AddClosedAndArchivedToChatChannel < ActiveRecord::Migration[6.1]
  def change
    add_column :chat_channels, :closed, :boolean, default: false, null: false
    add_column :chat_channels, :archived, :boolean, default: false, null: false
  end
end
