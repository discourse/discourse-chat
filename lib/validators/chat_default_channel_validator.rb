# frozen_string_literal: true

class ChatDefaultChannelValidator
  def initialize(opts = {})
    @opts = opts
  end

  def valid_value?(value)
    return false if value != "" && !ChatChannel.public_channels.pluck(:id).include?(value.to_i)
    true
  end

  def error_message
    I18n.t("site_settings.errors.chat_default_channel")
  end
end
