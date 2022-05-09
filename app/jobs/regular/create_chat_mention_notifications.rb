# frozen_string_literal: true

module Jobs
  class CreateChatMentionNotifications < ::Jobs::Base

    def execute(args = {})
      @chat_message = ChatMessage.includes(:user, :revisions, chat_channel: :chatable).find_by(id: args[:chat_message_id])
      return if @chat_message.nil? || @chat_message.revisions.where("created_at > ?", args[:timestamp]).any?

      @creator = @chat_message.user
      @chat_channel = @chat_message.chat_channel
      @is_direct_message_channel = @chat_channel.direct_message_channel?
      @already_notified_user_ids = args[:already_notified_user_ids] || []
      user_ids_to_notify = args[:to_notify_ids_map] || {}

      user_ids_to_notify.each do |mention_type, ids|
        process_mentions(ids, mention_type.to_sym)
      end
    end

    private

    def get_memberships(user_ids)
      UserChatChannelMembership.includes(:user).where(
        user_id: (user_ids - @already_notified_user_ids),
        chat_channel_id: @chat_message.chat_channel_id,
        following: true
      )
    end

    def build_data_for(membership, identifier_type:)
      data = {
        chat_message_id: @chat_message.id,
        chat_channel_id: @chat_channel.id,
        mentioned_by_username: @creator.username,
        is_direct_message_channel: @is_direct_message_channel
      }

      data[:chat_channel_title] = @chat_channel.title(membership.user) unless @is_direct_message_channel
      return data if identifier_type == :direct_mentions

      case identifier_type
      when :here_mentions
        data[:identifier] = 'here'
      when :global_mentions
        data[:identifier] = 'all'
      else
        data[:is_group_mention] = true
      end

      data
    end

    def build_payload_for(membership, identifier_type:)
      translation_prefix = @is_direct_message_channel ?
        "discourse_push_notifications.popup.direct_message_chat_mention" :
        "discourse_push_notifications.popup.chat_mention"
      translation_suffix = identifier_type == :direct_mentions ? "direct" : "other"

      identifier_text = case identifier_type
                        when :here_mentions
                          'here'
                        when :global_mentions
                          'all'
        else
                          ''
      end

      {
        translated_title: I18n.t("#{translation_prefix}.#{translation_suffix}",
          username: @creator.username,
          identifier: identifier_text,
          channel: @chat_channel.title(membership.user)
        ),
        notification_type: Notification.types[:chat_mention],
        username: @creator.username,
        tag: DiscourseChat::ChatNotifier.push_notification_tag(:mention, @chat_channel.id),
        excerpt: @chat_message.push_notification_excerpt,
        post_url: "/chat/channel/#{@chat_channel.id}/#{@chat_channel.title(membership.user)}?messageId=#{@chat_message.id}"
      }
    end

    def create_notification!(membership, notification_data)
      is_read = DiscourseChat::ChatNotifier.user_has_seen_message?(membership, @chat_message.id)

      notification = Notification.create!(
        notification_type: Notification.types[:chat_mention],
        user_id: membership.user_id,
        high_priority: true,
        data: notification_data.to_json,
        read: is_read
      )
      ChatMention.create!(notification: notification, user: membership.user, chat_message: @chat_message)
    end

    def send_notifications(membership, notification_data, os_payload)
      create_notification!(membership, notification_data)

      if !membership.desktop_notifications_never?
        MessageBus.publish("/chat/notification-alert/#{membership.user_id}", os_payload, user_ids: [membership.user_id])
      end

      if !membership.mobile_notifications_never?
        PostAlerter.push_notification(membership.user, os_payload)
      end
    end

    def process_mentions(user_ids, mention_type)
      memberships = get_memberships(user_ids)

      memberships.each do |membership|
        notification_data = build_data_for(membership, identifier_type: mention_type)
        payload = build_payload_for(membership, identifier_type: mention_type)

        send_notifications(membership, notification_data, payload)
      end
    end
  end
end
