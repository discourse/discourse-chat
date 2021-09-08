# frozen_string_literal: true

class UserChatChannelMembershipSerializer < ApplicationSerializer
  attributes :following,
             :muted,
             :desktop_notification_level,
             :mobile_notification_level
end
