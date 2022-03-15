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
          identifier_info = (args["user_ids_to_identifier_map"] || {})[membership.user_id.to_s]
          send_mention_notification_to_user(membership.user, identifier_info)
          send_os_notifications(membership, identifier_info)
        end
      end
    end

    def send_mention_notification_to_user(user, identifier_info)
      data = {
        chat_message_id: @chat_message.id,
        chat_channel_id: @chat_channel.id,
        chat_channel_title: @chat_channel.title_for_mention(user),
        mentioned_by_username: @creator.username,
      }
      data[:identifier] = identifier_info["identifier"] if identifier_info.present?
      data[:is_group_mention] = true if (identifier_info || {})["is_group"]

      notification = Notification.create!(
        notification_type: Notification.types[:chat_mention],
        user_id: user.id,
        high_priority: true,
        data: data.to_json
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
                                 identifier: transform_identifier(identifier_info),
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

    def transform_identifier(identifier_info)
      return if identifier_info.nil?

      # Translated `:global -> @all` and `:here -> @here`
      # we don't want these strings translated, so we need to pass them into the translation.
      # Or if the identifier is a group name simple return that.
      identifier = identifier_info["identifier"]
      identifier = identifier.to_s.sub('global', 'all') unless identifier_info["is_group"]
      "@#{identifier}"
    end
  end
end
