# frozen_string_literal: true

module Jobs
  class ChatNotifyWatching < ::Jobs::Base
    def execute(args = {})
      @chat_message = ChatMessage.includes(:user, chat_channel: :chatable).find_by(id: args[:chat_message_id])
      return if @chat_message.nil?

      @creator = @chat_message.user
      @chat_channel = @chat_message.chat_channel
      @is_direct_message_channel = @chat_channel.direct_message_channel?

      always_notification_level = UserChatChannelMembership::NOTIFICATION_LEVELS[:always]

      UserChatChannelMembership
        .includes(user: :groups)
        .joins(user: :user_option)
        .where(user_option: { chat_enabled: true })
        .where.not(user_id: args[:except_user_ids])
        .where(chat_channel_id: @chat_channel.id)
        .where(following: true)
        .where("desktop_notification_level = ? OR mobile_notification_level = ?",
               always_notification_level, always_notification_level)
        .merge(User.not_suspended)
        .each do |membership|
        send_notifications(membership)
      end
    end

    def send_notifications(membership)
      user = membership.user
      guardian = Guardian.new(user)
      return unless guardian.can_chat?(user) && guardian.can_see_chat_channel?(@chat_channel)
      return if DiscourseChat::ChatNotifier.user_has_seen_message?(membership, @chat_message.id)
      return if online_user_ids.include?(user.id)

      translation_key = @is_direct_message_channel ?
        "discourse_push_notifications.popup.new_direct_chat_message" :
        "discourse_push_notifications.popup.new_chat_message"

      translation_args = { username: @creator.username }
      translation_args[:channel] = @chat_channel.title(user) unless @is_direct_message_channel

      payload = {
        username: @creator.username,
        notification_type: Notification.types[:chat_message],
        post_url: "/chat/channel/#{@chat_channel.id}/#{@chat_channel.title(user)}",
        translated_title: I18n.t(translation_key, translation_args),
        tag: DiscourseChat::ChatNotifier.push_notification_tag(:message, @chat_channel.id),
        excerpt: @chat_message.push_notification_excerpt
      }

      if membership.desktop_notifications_always?
        MessageBus.publish("/notification-alert/#{user.id}", payload, user_ids: [user.id])
      end

      if membership.mobile_notifications_always?
        PostAlerter.push_notification(user, payload)
      end
    end

    def online_user_ids
      @online_user_ids ||= PresenceChannel.new("/chat/online").user_ids
    end
  end
end
