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
      @user_ids_to_group_mention_map = args[:user_ids_to_group_mention_map] || {}
      @memberships.each do |membership|
        unless DiscourseChat::ChatNotifier.user_has_seen_message?(membership, @chat_message.id)
          group_name = @user_ids_to_group_mention_map[membership.user.id.to_s]
          mention_type = group_name.present? ?
            :chat_group_mention :
            :chat_mention
          send_mention_notification_to_user(membership.user, mention_type, group_name)
          send_os_notifications(membership, mention_type, group_name)
        end
      end
    end

    def send_mention_notification_to_user(user, mention_type, group_name)
      notification = Notification.create!(
        notification_type: Notification.types[mention_type],
        user_id: user.id,
        high_priority: true,
        data: {
          message: "notifications.popup.#{mention_type}",
          group_name: group_name,
          chat_message_id: @chat_message.id,
          chat_channel_id: @chat_channel.id,
          chat_channel_title: @chat_channel.title(user),
          mentioned_by_username: @creator.username,
        }.to_json
      )
      ChatMention.create!(notification: notification, user: user, chat_message: @chat_message)
    end

    def send_os_notifications(membership, mention_type, group_name)
      return if membership.desktop_notifications_never? && membership.mobile_notifications_never?

      payload = {
        notification_type: Notification.types[mention_type],
        username: @creator.username,
        translated_title: I18n.t("discourse_push_notifications.popup.#{mention_type}",
                                 username: @creator.username,
                                 group_name: group_name
                                ),
        tag: DiscourseChat::ChatNotifier.push_notification_tag(:mention, @chat_channel.id),
        excerpt: @chat_message.push_notification_excerpt,
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
