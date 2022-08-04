# frozen_string_literal: true

class UserChatChannelMembershipSerializer < ApplicationSerializer
  attributes :following,
             :muted,
             :desktop_notification_level,
             :mobile_notification_level,
             :chat_channel_id,
             :user_count,
             :last_read_message_id,
             :unread_count,
             :unread_mentions

  has_one :user, serializer: BasicUserSerializer, embed: :objects

  def include_user?
    return true if scope.anonymous?
    scope.user.id != object.user_id
  end

  def user_count
    object.chat_channel.user_count
  end
end
