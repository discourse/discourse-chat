# frozen_string_literal: true

module Jobs
  class UpdateUserCountsForChatChannels < ::Jobs::Scheduled
    every 2.hours

    def execute(args = {})
      ChatChannel.find_each do |chat_channel|
        set_user_count(chat_channel)
      end
    end

    def set_user_count(chat_channel)
      current_count = chat_channel.user_count || 0
      new_count = chat_channel
        .user_chat_channel_memberships
        .joins(:user)
        .where(user: {active: true, suspended_till: nil, staged: false})
        .where(following: true)
        .count

      return if current_count == new_count

      chat_channel.update(user_count: new_count)
    end
  end
end
