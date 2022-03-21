# frozen_string_literal: true

require 'migration/table_dropper'

class DropChatMessagePostConnectionsTable < ActiveRecord::Migration[6.1]
  DROPPED_TABLES ||= %i{
    chat_message_post_connections
  }

  def up
    DROPPED_TABLES.each do |table|
      Migration::TableDropper.execute_drop(table)
    end
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
