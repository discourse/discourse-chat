# frozen_string_literal: true

module Jobs
  class CreateChatMentionNotifications < ::Jobs::Base

    def execute(args = {})
      @chat_message = ChatMessage.includes(:user, :revisions, chat_channel: :chatable).find_by(id: args[:chat_message_id])
      return if @chat_message.nil? || @chat_message.revisions.where("created_at > ?", args[:timestamp]).any?

      @creator = @chat_message.user
      @memberships = UserChatChannelMembership.includes(:user).where(
        user_id: args[:user_ids],
        chat_channel_id: @chat_message.chat_channel_id,
        following: true
      )
      @chat_channel = @chat_message.chat_channel
      @memberships.each do |membership|
        unless DiscourseChat::ChatNotifier.user_has_seen_message?(membership, @chat_message.id)
          send_mention_notification_to_user(membership.user)
          send_os_notifications(membership)
        end
      end
    end

    def send_mention_notification_to_user(user)
      notification = Notification.create!(
        notification_type: Notification.types[:chat_mention],
        user_id: user.id,
        high_priority: true,
        data: {
          message: 'chat.mention_notification',
          chat_message_id: @chat_message.id,
          chat_channel_id: @chat_channel.id,
          chat_channel_title: @chat_channel.title(user),
          mentioned_by_username: @creator.username,
        }.to_json
      )
      ChatMention.create!(notification: notification, user: user, chat_message: @chat_message)
    end

    def send_os_notifications(membership)
      return if membership.desktop_notifications_never? && membership.mobile_notifications_never?

      payload = {
        notification_type: Notification.types[:chat_mention],
        username: @creator.username,
        translated_title: I18n.t("discourse_push_notifications.popup.chat_mention",
                                 username: @creator.username
                                ),
        tag: DiscourseChat::ChatNotifier.push_notification_tag(:mention, @chat_channel.id),
        excerpt: @chat_message.excerpt,
        post_url: "/chat/channel/#{@chat_channel.id}/#{@chat_channel.title(membership.user)}?messageId=#{@chat_message.id}"
      }

      unless membership.desktop_notifications_never?
        MessageBus.publish("/chat/notification-alert/#{membership.user.id}", payload, user_ids: [membership.user.id])
      end

      unless membership.mobile_notifications_never?
        PostAlerter.push_notification(membership.user, payload)
      end
    end
  end
end
