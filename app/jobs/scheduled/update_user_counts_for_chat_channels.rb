# frozen_string_literal: true

module Jobs
  class UpdateUserCountsForChatChannels < ::Jobs::Scheduled
    every 2.hours

    def execute(args = {})
      ChatChannel.find_each { |chat_channel| set_user_count(chat_channel) }
    end

    def set_user_count(chat_channel)
      current_count = chat_channel.user_count || 0
      new_count =
        chat_channel
          .user_chat_channel_memberships
          .joins(:user)
          .where(following: true)
          .merge(User.activated.not_suspended.not_staged)
          .count

      return if current_count == new_count

      chat_channel.update(user_count: new_count)
    end
  end
end
