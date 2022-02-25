# frozen_string_literal: true

class ChatChannelSettingsSerializer < ChatChannelSerializer
  attributes :desktop_notification_level,
             :mobile_notification_level,
             :following

  has_one :last_chat_message, serializer: ChatInReplyToSerializer, embed: :objects
end
