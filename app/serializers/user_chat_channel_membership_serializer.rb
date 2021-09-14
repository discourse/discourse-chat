# frozen_string_literal: true

class UserChatChannelMembershipSerializer < ApplicationSerializer
  attributes :following,
             :muted,
             :desktop_notification_level,
             :mobile_notification_level,
             :chat_channel_id,
             :chatable_type

  def chatable_type
    object.chat_channel.chatable_type
  end
end
