# frozen_string_literal: true

module Jobs
  class SendChatNotifications < ::Jobs::Base
    MENTION_REGEX = /\@\w+/

    def execute(args = {})
      return unless validate_args(args)

      @chat_message = ChatMessage.includes(:user, chat_channel: :chatable).find_by(id: args[:chat_message_id])
      return if @chat_message.nil?

      @chat_channel = @chat_message.chat_channel
      @user = @chat_message.user

      if args[:type] == :new
        mentioned_user_ids = create_mention_notifications
        notify_watching_users(except: [@user.id] + mentioned_user_ids)
      elsif args[:type] == :edit
        update_mention_notifications
      end

    end

    private

    def validate_args(args)
      return false unless [:new, :edit].include?(args[:type])

      true
    end

    def update_mention_notifications
      existing_notifications = Notification
        .where(notification_type: Notification.types[:chat_mention])
        .where("data LIKE ?", "%\"chat_message_id\":#{@chat_message.id}%")

      already_notified_user_ids = existing_notifications.map(&:user_id)
      mentioned_user_ids = mentioned_users.map(&:id)

      needs_deletion = already_notified_user_ids - mentioned_user_ids
      needs_deletion.each do |user_id|
        notification = existing_notifications.detect { |n| n.user_id == user_id }
        notification.destroy!
      end

      needs_notification_ids = mentioned_user_ids - already_notified_user_ids
      return unless needs_notification_ids.present?

      needs_notification = User
        .includes(:do_not_disturb_timings, :user_chat_channel_memberships)
        .where(id: needs_notification_ids)
      needs_notification.each { |target_user|
        guardian = Guardian.new(target_user)
        if guardian.can_chat?(target_user) && guardian.can_see_chat_channel?(@chat_channel)
          create_mention_notification_for_user(target_user)
        end
      }
    end

    def create_mention_notifications
      mentioned_user_ids = []
      mentioned_users.each do |target_user|
        create_mention_notification_for_user(target_user)
        mentioned_user_ids.push(target_user.id)
        ChatPublisher.publish_new_mention(target_user, @chat_channel.id, @chat_message.id)
      end
      mentioned_user_ids
    end

    def mentioned_users
      @mentioned_users ||= begin
        mention_matches = @chat_message.message.scan(MENTION_REGEX)
        if mention_matches.include?("@all")
          users = users_for_channel(exclude: @user.username)
        else
          users = mention_matches.include?("@here") ?
            users_here(mention_matches) :
            users_for_channel(
              exclude: @user.username,
              usernames: mention_matches.map { |match| match[1..-1] }
            )
        end
        filter_users_who_can_chat(users)
      end
    end

    def users_here(mention_matches)
      users = users_for_channel(exclude: @user.username).where("last_seen_at > ?", 5.minutes.ago)
      usernames = users.map(&:username)
      other_mentioned_usernames = mention_matches
        .map { |match| match[1..-1] }
        .reject { |username| username == "here" || usernames.include?(username) }
      if other_mentioned_usernames.any?
        users = users.or(
          users_for_channel(
            exclude: @user.username,
            usernames: other_mentioned_usernames
          )
        )
      end

      users
    end

    def users_for_channel(exclude:, usernames: nil)
      users = User
        .includes(:do_not_disturb_timings, :push_subscriptions, :groups, :user_chat_channel_memberships)
        .joins(:user_chat_channel_memberships)
        .joins(:user_option)
        .not_suspended
        .where(user_options: { chat_enabled: true })
        .where(user_chat_channel_memberships: { following: true, chat_channel_id: @chat_channel.id })
        .where.not(username_lower: exclude.downcase)
      users = users.where(username_lower: usernames.map(&:downcase)) if usernames
      users
    end

    def filter_users_who_can_chat(users)
      users.select do |user|
        guardian = Guardian.new(user)
        guardian.can_chat?(user) && guardian.can_see_chat_channel?(@chat_channel)
      end
    end

    def create_mention_notification_for_user(mentioned_user)
      return if mentioned_user.do_not_disturb? || user_has_seen_message(mentioned_user)

      Notification.create!(
        notification_type: Notification.types[:chat_mention],
        user_id: mentioned_user.id,
        high_priority: true,
        data: {
          message: 'chat.mention_notification',
          chat_message_id: @chat_message.id,
          chat_channel_id: @chat_channel.id,
          chat_channel_title: @chat_channel.title(mentioned_user),
          mentioned_by_username: @user.username,
        }.to_json
      )
      send_mentioned_os_notifications(mentioned_user)
    end

    def send_mentioned_os_notifications(mentioned_user)
      payload = {
        notification_type: Notification.types[:chat_mention],
        username: @user.username,
        translated_title: I18n.t("discourse_push_notifications.popup.chat_mention",
                                 username: @user.username
                                ),
        tag: push_notification_tag(:mention),
        excerpt: @chat_message.excerpt,
        post_url: "/chat/channel/#{@chat_channel.id}/#{@chat_channel.title(mentioned_user)}?messageId=#{@chat_message.id}"
      }
      membership = mentioned_user.user_chat_channel_memberships.detect { |m| m.chat_channel_id == @chat_channel.id }
      return if !membership || membership.muted

      unless membership.desktop_notifications_never?
        MessageBus.publish("/chat/notification-alert/#{mentioned_user.id}", payload, user_ids: [mentioned_user.id])
      end

      unless membership.mobile_notifications_never?
        PostAlerter.push_notification(mentioned_user, payload)
      end
    end

    def notify_watching_users(except: [])
      always_notification_level = UserChatChannelMembership::NOTIFICATION_LEVELS[:always]
      UserChatChannelMembership
        .includes(user: :groups)
        .joins(user: :user_option)
        .where(user_option: { chat_enabled: true })
        .where.not(user_id: except)
        .where(chat_channel_id: @chat_channel.id)
        .where(following: true)
        .where("desktop_notification_level = ? OR mobile_notification_level = ?",
               always_notification_level, always_notification_level)
        .merge(User.not_suspended)
        .each do |membership|
          user = membership.user
          guardian = Guardian.new(user)
          next unless guardian.can_chat?(user) && guardian.can_see_chat_channel?(@chat_channel)
          next if user_has_seen_message(user)

          payload = {
            username: @user.username,
            notification_type: Notification.types[:chat_message],
            post_url: "/chat/channel/#{@chat_channel.id}/#{@chat_channel.title(user)}",
            translated_title: I18n.t("discourse_push_notifications.popup.chat_message",
                                     chat_channel_title: @chat_channel.title(membership.user)
                                    ),
            tag: push_notification_tag(:message),
            excerpt: @chat_message.excerpt
          }
          if membership.desktop_notifications_always?
            MessageBus.publish("/chat/notification-alert/#{user.id}", payload, user_ids: [user.id])
          end

          if membership.mobile_notifications_always? && !online_user_ids.include?(user.id)
            PostAlerter.push_notification(user, payload)
          end
        end
    end

    def user_has_seen_message(user)
      membership = user.user_chat_channel_memberships.detect do |membership|
        membership.chat_channel_id == @chat_channel.id
      end

      (membership.last_read_message_id || 0) >= @chat_message.id
    end

    def online_user_ids
      @online_user_ids ||= PresenceChannel.new("/chat/online").user_ids
    end

    def push_notification_tag(type)
      "#{Discourse.current_hostname}-chat-#{type}-#{@chat_channel.id}"
    end
  end
end
