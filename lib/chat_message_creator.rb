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
    end
  end

  def failed?
    @error.present?
  end

  private

  def notify_watching_users(except: [])
    always_notification_level = UserChatChannelMembership::NOTIFICATION_LEVELS[:always]
    UserChatChannelMembership
      .includes(:user)
      .where.not(user_id: except)
      .where(chat_channel_id: @chat_channel.id)
      .where(following: true)
      .where("desktop_notification_level = ? OR mobile_notification_level = ?",
             always_notification_level, always_notification_level)
      .each do |membership|
        user = membership.user
        payload = {
          notification_type: Notification.types[:chat_message],
          post_url: "/chat/channel/#{@chat_channel.title(user)}",
          translated_title: I18n.t("discourse_push_notifications.popup.chat_message",
                                   chat_channel_title: @chat_channel.title(membership.user)
                                  )
        }
        if membership.desktop_notifications_always?
          MessageBus.publish("/notification-alert/#{user.id}", payload, user_ids: [user.id])
        end

        if membership.mobile_notifications_always? && user.push_subscriptions.exists?
          Jobs.enqueue(:send_push_notification, user_id: user.id, payload: payload)
        end
      end
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
        mentioned_user_ids = target_user.id
      end
    end
    mentioned_user_ids
  end

  def self.mentioned_users(chat_message:, creator:)
    mention_matches = chat_message.message.scan(MENTION_REGEX)
    mention_matches.reject! { |match| ["@#{creator.username}", "@system"].include?(match) }
    User
      .includes(:do_not_disturb_timings, :user_chat_channel_memberships) # Avoid n+1 for push notifications
      .joins(:user_chat_channel_memberships)
      .where(user_chat_channel_memberships: { chat_channel_id: chat_message.chat_channel_id })
      .where(username: mention_matches.map { |match| match[1..-1] })
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
      post_url: "/chat/channel/#{chat_channel.title(mentioned)}?messageId=#{chat_message.id}"
    }
    membership = mentioned.user_chat_channel_memberships.detect { |m| m.chat_channel_id == chat_channel.id }
    return if !membership || membership.muted

    unless membership.desktop_notifications_never?
      MessageBus.publish("/notification-alert/#{mentioned.id}", payload, user_ids: [mentioned.id])
    end

    if !membership.mobile_notifications_never? && mentioned.push_subscriptions.exists?
      Jobs.enqueue(:send_push_notification, user_id: mentioned.id, payload: payload)
    end
  end
end
