# frozen_string_literal: true

class ChatAllowUploadsValidator
  def initialize(opts = {})
    @opts = opts
  end

  def valid_value?(value)
    return true if value == "f"
    if value == "t" && SiteSetting.secure_media && !GlobalSetting.allow_unsecure_chat_uploads
      return false
    end
    true
  end

  def error_message
    if SiteSetting.secure_media && !GlobalSetting.allow_unsecure_chat_uploads
      I18n.t("site_settings.errors.chat_upload_not_allowed_secure_media")
    end
  end
end
