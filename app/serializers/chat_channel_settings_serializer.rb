# frozen_string_literal: true

class ChatChannelSettingsSerializer < ChatChannelSerializer
  attributes :desktop_notification_level, :mobile_notification_level, :following
end
