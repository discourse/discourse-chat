# frozen_string_literal: true

module Jobs
  class AutoJoinUsers < ::Jobs::Scheduled
    every 1.hour

    def execute(_args)
      ChatChannel
        .where(auto_join_users: true)
        .each { |channel| UserChatChannelMembership.enforce_automatic_channel_memberships(channel) }
    end
  end
end
