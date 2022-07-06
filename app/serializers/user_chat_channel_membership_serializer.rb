# frozen_string_literal: true

class UserChatChannelMembershipSerializer < ApplicationSerializer
  attributes :following,
             :muted,
             :desktop_notification_level,
             :mobile_notification_level,
             :chat_channel_id,
             :user_count,
             :last_read_message_id

  has_one :user, serializer: BasicUserWithStatusSerializer, embed: :objects

  def user_count
    object.chat_channel.user_count
  end
end
