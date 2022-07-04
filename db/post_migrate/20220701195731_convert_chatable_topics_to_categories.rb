# frozen_string_literal: true

class ConvertChatableTopicsToCategories < ActiveRecord::Migration[7.0]
  def up
    # convert chatable topics to categories using topic's category_id or default category
    DB.exec(<<~SQL, uncategorized_category_id: SiteSetting.uncategorized_category_id)
      UPDATE chat_channels cc
      SET chatable_type = 'Category', chatable_id = coalesce(
        (
          SELECT t.category_id
          FROM topics t
          WHERE cc.chatable_id = t.id
        ),
        :uncategorized_category_id
      )
      WHERE cc.chatable_type = 'Topic'
      SQL

    # soft delete all posts small actions
    DB.exec(
      "UPDATE posts SET deleted_at = :deleted_at, deleted_by_id = :deleted_by WHERE action_code IN (:action_codes)",
      action_codes: ['chat.enabled', 'chat.disabled'],
      deleted_at: Time.zone.now,
      deleted_by: Discourse.system_user
    )

    # removes all chat custom fields
    DB.exec(<<~SQL)
      DELETE FROM topic_custom_fields
      WHERE name = 'has_chat_enabled'
    SQL
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
