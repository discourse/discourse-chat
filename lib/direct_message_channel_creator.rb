# frozen_string_literal: true

module DiscourseChat::DirectMessageChannelCreator
  attr_reader :chat_channel, :users

  def self.create(users)
    direct_messages_channel = DirectMessageChannel.create!(users: users)
    chat_channel = ChatChannel.create!(chatable: direct_messages_channel)
    users.each do |user|
      UserChatChannelMembership.create(
        user_id: user.id,
        chat_channel_id: chat_channel.id,
        last_read_message_id: nil,
        following: true,
        muted: false,
        desktop_notification_level: UserChatChannelMembership::NOTIFICATION_LEVELS[:always],
        mobile_notification_level: UserChatChannelMembership::NOTIFICATION_LEVELS[:always],
      )
    end

    chat_channel
  end
end
