# frozen_string_literal: true

module DiscourseChat::DirectMessageChannelCreator
  attr_reader :chat_channel, :users

  def self.create!(creator, users)
    direct_messages_channel = DirectMessageChannel.for_user_ids(users.map(&:id).uniq)
    if direct_messages_channel
      chat_channel = ChatChannel.find_by!(chatable: direct_messages_channel)
    else
      direct_messages_channel = DirectMessageChannel.create!(users: users)
      chat_channel = ChatChannel.create!(chatable: direct_messages_channel)
    end

    update_memberships(users, chat_channel.id)
    ChatPublisher.publish_new_direct_message_channel(chat_channel, creator, users)
    chat_channel
  end

  private

  def self.update_memberships(users, chat_channel_id)
    users.each do |user|
      membership = UserChatChannelMembership.find_or_initialize_by(user_id: user.id, chat_channel_id: chat_channel_id)

      if membership.new_record?
        membership.last_read_message_id = nil
        membership.desktop_notification_level = UserChatChannelMembership::NOTIFICATION_LEVELS[:always]
        membership.mobile_notification_level = UserChatChannelMembership::NOTIFICATION_LEVELS[:always]
        membership.muted = false
      end

      membership.following = true
      membership.save!
    end
  end
end
