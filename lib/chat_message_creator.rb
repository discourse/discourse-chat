# frozen_string_literal: true
class DiscourseChat::ChatMessageCreator
  MENTION_REGEX = /\@\w+/
  attr_reader :error
  attr_reader :chat_message

  def self.create(opts)
    instance = new(**opts)
    instance.create
    instance
  end

  def initialize(chat_channel:, in_reply_to_id: nil, user:, content:, staged_id: nil, incoming_chat_webhook: nil)
    @chat_channel = chat_channel
    @user = user
    @in_reply_to_id = in_reply_to_id
    @content = content
    @staged_id = staged_id
    @incoming_chat_webhook = incoming_chat_webhook
    @error = nil

    @chat_message = ChatMessage.new(
      chat_channel: @chat_channel,
      user_id: @user.id,
      in_reply_to_id: @in_reply_to_id,
      message: @content,
    )

    if @incoming_chat_webhook
      ChatWebhookEvent.create(
        chat_message: @chat_message,
        incoming_chat_webhook: @incoming_chat_webhook
      )
    end
  end

  def create
    begin
      @chat_message.save!
      mentioned_user_ids = create_mention_notifications
      notify_watching_users(except: [@user.id] + mentioned_user_ids)
      ChatPublisher.publish_new!(@chat_channel, @chat_message, @staged_id)
    rescue => error
      @error = error
      if Rails.env.test?
        puts "#" * 50
        puts "Chat message creation error:"
        puts @error.inspect
        puts "#" * 50
      end
    end
  end

  def failed?
    @error.present?
  end

  private

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
        next unless Guardian.new.can_chat?(user)
        payload = {
          username: @user.username,
          notification_type: Notification.types[:chat_message],
          post_url: "/chat/channel/#{@chat_channel.title(user)}",
          translated_title: I18n.t("discourse_push_notifications.popup.chat_message",
                                   chat_channel_title: @chat_channel.title(membership.user)
                                  ),
          excerpt: chat_message.message[0..399]
        }
        if membership.desktop_notifications_always?
          MessageBus.publish("/notification-alert/#{user.id}", payload, user_ids: [user.id])
        end

        if membership.mobile_notifications_always? && !online_user_ids.include?(user.id)
          PostAlerter.push_notification(user, payload)
        end
      end
  end

  def online_user_ids
    @online_user_ids ||= PresenceChannel.new("/chat/online").user_ids
  end

  def create_mention_notifications
    mentioned_user_ids = []
    self.class.mentioned_users(chat_message: @chat_message, creator: @user)
      .each do |target_user|
      if Guardian.new(target_user).can_see_chat_channel?(@chat_channel)
        self.class.create_mention_notification(
          creator_username: @user.username,
          mentioned_user: target_user,
          chat_channel: @chat_channel,
          chat_message: @chat_message,
        )
        mentioned_user_ids.push(target_user.id)
        ChatPublisher.publish_new_mention(target_user, @chat_channel.id, @chat_message.id)
      end
    end
    mentioned_user_ids
  end

  def self.mentioned_users(chat_message:, creator:)
    mention_matches = chat_message.message.scan(MENTION_REGEX)
    if mention_matches.include?("@all")
      users = users_for_channel(chat_message.chat_channel_id, exclude: creator.username)
    else
      users = mention_matches.include?("@here") ?
        users_here(chat_message.chat_channel_id, creator.username, mention_matches) :
        users_for_channel(
          chat_message.chat_channel_id,
          exclude: creator.username,
          usernames: mention_matches.map { |match| match[1..-1] }
        )
    end
    filter_users_who_can_chat(users)
  end

  def self.users_here(chat_channel_id, creator_username, mention_matches)
    users = users_for_channel(chat_channel_id, exclude: creator_username).where("last_seen_at > ?", 5.minutes.ago)
    usernames = users.map(&:username)
    other_mentioned_usernames = mention_matches
      .map { |match| match[1..-1] }
      .reject { |username| username == "here" || usernames.include?(username) }
    if other_mentioned_usernames.any?
      users = users.or(
        users_for_channel(
          chat_channel_id,
          exclude: creator_username,
          usernames: other_mentioned_usernames
        )
      )
    end

    filter_users_who_can_chat(users)
  end

  def self.users_for_channel(chat_channel_id, exclude:, usernames: nil)
    users = User
      .includes(:do_not_disturb_timings, :push_subscriptions, :groups)
      .joins(:user_chat_channel_memberships)
      .joins(:user_option)
      .not_suspended
      .where(user_options: { chat_enabled: true })
      .where(user_chat_channel_memberships: { chat_channel_id: chat_channel_id })
      .where.not(username: exclude)
    users = users.where(username_lower: usernames.map(&:downcase)) if usernames
    users
  end

  def self.filter_users_who_can_chat(users)
    guardian = Guardian.new
    users.select { |user| guardian.can_chat?(user) }
  end

  def self.create_mention_notification(creator_username:, mentioned_user:, chat_channel:, chat_message:)
    return if mentioned_user.do_not_disturb?

    Notification.create!(
      notification_type: Notification.types[:chat_mention],
      user_id: mentioned_user.id,
      high_priority: true,
      data: {
        message: 'chat.mention_notification',
        chat_message_id: chat_message.id,
        chat_channel_id: chat_channel.id,
        chat_channel_title: chat_channel.title(mentioned_user),
        mentioned_by_username: creator_username,
      }.to_json
    )
    send_mentioned_os_notifications(
      chat_channel: chat_channel,
      chat_message: chat_message,
      mentioned: mentioned_user,
      mentioner_username: creator_username
    )
  end

  def self.send_mentioned_os_notifications(chat_channel:, chat_message:, mentioned:, mentioner_username:)
    payload = {
      notification_type: Notification.types[:chat_mention],
      username: mentioned.username,
      translated_title: I18n.t("discourse_push_notifications.popup.chat_mention",
                               username: mentioner_username
                              ),
      excerpt: chat_message.message[0..399],
      post_url: "/chat/channel/#{chat_channel.title(mentioned)}?messageId=#{chat_message.id}"
    }
    membership = mentioned.user_chat_channel_memberships.detect { |m| m.chat_channel_id == chat_channel.id }
    return if !membership || membership.muted

    unless membership.desktop_notifications_never?
      MessageBus.publish("/notification-alert/#{mentioned.id}", payload, user_ids: [mentioned.id])
    end

    unless membership.mobile_notifications_never?
      PostAlerter.push_notification(mentioned, payload)
    end
  end
end
