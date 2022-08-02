# frozen_string_literal: true

class DisableChatUploadsIfSecureMediaEnabled < ActiveRecord::Migration[7.0]
  ##
  # At this point in time, secure media is not compatible with discourse-chat,
  # so if it is enabled then chat uploads must be disabled to avoid undesirable
  # behaviour.
  #
  # The env var DISCOURSE_ALLOW_UNSECURE_CHAT_UPLOADS can be set to keep
  # it enabled, but this is strongly advised against.
  def up
    chat_allow_uploads_value = DB.query_single("SELECT value FROM site_settings WHERE name = 'chat_allow_uploads'").first
    chat_uploads_enabled = chat_allow_uploads_value == "t"
    secure_media_enabled = DB.query_single("SELECT value FROM site_settings WHERE name = 'secure_media'").first == "t"

    if secure_media_enabled && chat_uploads_enabled && !ENV["DISCOURSE_ALLOW_UNSECURE_CHAT_UPLOADS"]
      if chat_allow_uploads_value.nil?
        DB.exec("
          INSERT INTO site_settings(name, data_type, value, created_at, updated_at)
          VALUES('chat_allow_uploads', 5, 'f', NOW(), NOW())
        ")
      else
        DB.exec("UPDATE site_settings SET value = 'f' WHERE name = 'chat_allow_uploads'")
      end
    end
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
