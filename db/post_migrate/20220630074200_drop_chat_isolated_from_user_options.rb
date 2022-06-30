# frozen_string_literal: true

class DropChatIsolatedFromUserOptions < ActiveRecord::Migration[7.0]
  DROPPED_COLUMNS ||= {
    user_options: %i{ chat_isolated }
  }

  def up
    DROPPED_COLUMNS.each do |table, columns|
      Migration::ColumnDropper.execute_drop(table, columns)
    end
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
