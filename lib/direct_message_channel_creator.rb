# frozen_string_literal: true

module DiscourseChat::DirectMessageChannelCreator
  def self.create!(acting_user:, target_users:)
    unique_target_users = target_users.uniq
    direct_messages_channel = DirectMessageChannel.for_user_ids(unique_target_users.map(&:id))
    if direct_messages_channel
      chat_channel = ChatChannel.find_by!(chatable: direct_messages_channel)
    else
      direct_messages_channel = DirectMessageChannel.create!(user_ids: unique_target_users.map(&:id))
      chat_channel = ChatChannel.create!(chatable: direct_messages_channel)
    end

    update_memberships(unique_target_users, chat_channel.id)
    ChatPublisher.publish_new_direct_message_channel(chat_channel, unique_target_users)
    chat_channel
  end

  private

  def self.update_memberships(unique_target_users, chat_channel_id)
    unique_target_users.each do |user|
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
