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
        is_read = DiscourseChat::ChatNotifier.user_has_seen_message?(membership, @chat_message.id)
        identifier_info = (args["user_ids_to_identifier_map"] || {})[membership.user_id.to_s]
        send_mention_notification_to_user(membership.user, identifier_info, is_read)
        send_os_notifications(membership, identifier_info) unless is_read
      end
    end

    def send_mention_notification_to_user(user, identifier_info, is_read)
      data = {
        chat_message_id: @chat_message.id,
        chat_channel_id: @chat_channel.id,
        chat_channel_title: @chat_channel.title_for_mention(user),
        mentioned_by_username: @creator.username,
        is_direct_message_channel: @chat_channel.direct_message_channel?
      }
      data[:identifier] = identifier_info["identifier"] if identifier_info.present?
      data[:is_group_mention] = true if (identifier_info || {})["is_group"]

      notification = Notification.create!(
        notification_type: Notification.types[:chat_mention],
        user_id: user.id,
        high_priority: true,
        data: data.to_json,
        read: is_read
      )
      ChatMention.create!(notification: notification, user: user, chat_message: @chat_message)
    end

    def send_os_notifications(membership, identifier_info)
      return if membership.desktop_notifications_never? && membership.mobile_notifications_never?

      i18n_key = "discourse_push_notifications.popup.chat_mention.#{identifier_info ? "other" : "direct"}"
      payload = {
        notification_type: Notification.types[:chat_mention],
        username: @creator.username,
        translated_title: I18n.t(i18n_key,
                                 username: @creator.username,
                                 identifier: identifier_info ? "@#{identifier_info["identifier"]}" : "",
                                 channel: @chat_channel.title_for_mention(membership.user)
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
