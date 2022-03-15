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

          mention_identifier = (args["user_ids_to_identifier_map"] || {})[membership.user_id.to_s]
          send_mention_notification_to_user(membership.user, mention_type, group_name, mention_identifier)
          send_os_notifications(membership, mention_type, group_name, mention_identifier)
        end
      end
    end

    def send_mention_notification_to_user(user, mention_type, group_name, mention_identifier)
      data = {
        chat_message_id: @chat_message.id,
        chat_channel_id: @chat_channel.id,
        chat_channel_title: @chat_channel.title_for_mention(user),
        mentioned_by_username: @creator.username,
      }
      data[:identifier] = mention_identifier if mention_identifier.present?
      data[:group_name] = group_name if group_name.present?

      notification = Notification.create!(
        notification_type: Notification.types[mention_type],
        user_id: user.id,
        high_priority: true,
        data: data.to_json
      )
      ChatMention.create!(notification: notification, user: user, chat_message: @chat_message)
    end

    def send_os_notifications(membership, mention_type, group_name, mention_identifier)
      return if membership.desktop_notifications_never? && membership.mobile_notifications_never?

      i18n_key = "discourse_push_notifications.popup.#{mention_type}"
      if mention_type == :chat_mention
        i18n_key += ".#{mention_identifier}"
      end

      payload = {
        notification_type: Notification.types[mention_type],
        username: @creator.username,
        translated_title: I18n.t(i18n_key_for_os_notifications(mention_type, mention_identifier),
                                 username: @creator.username,
                                 group_name: group_name,
                                 identifier: transform_identifier(mention_identifier),
                                 channel: @chat_channel.title_for_mention(membership.user)
                                ),
        tag: DiscourseChat::ChatNotifier.push_notification_tag(:mention, @chat_channel.id),
        excerpt: @chat_message.push_notification_excerpt,
        post_url: "/chat/channel/#{@chat_channel.id}/#{@chat_channel.title(membership.user).to_s.strip}?messageId=#{@chat_message.id}"
      }

      unless membership.desktop_notifications_never?
        MessageBus.publish("/chat/notification-alert/#{membership.user.id}", payload, user_ids: [membership.user.id])
      end

      unless membership.mobile_notifications_never?
        PostAlerter.push_notification(membership.user, payload)
      end
    end

    def transform_identifier(identifier)
      # Translated `:global -> @all` and `:here -> @here`
      # we don't want these strings translated, so we need to pass them into the translation.
      "@#{identifier.to_s.sub('global', 'all')}"
    end

    def i18n_key_for_os_notifications(mention_type, identifier)
      if mention_type == :chat_group_mention
        return "discourse_push_notifications.popup.chat_group_mention"
      end

      "discourse_push_notifications.popup.chat_mention.#{identifier.present? ? 'other' : 'direct'}"
    end
  end
end
