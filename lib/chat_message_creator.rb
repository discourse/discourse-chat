# frozen_string_literal: true
class DiscourseChat::ChatMessageCreator
  MENTION_REGEX = /\@\w+/
  attr_reader :error
  attr_reader :chat_message

  def self.create(opts)
    instance = new(opts)
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
      create_mention_notifications
      ChatPublisher.publish_new!(@chat_channel, @chat_message, @staged_id)
    rescue => error
      puts '########'
      puts error.inspect
      puts '########'
      @error = error
    end
  end

  def failed?
    @error.present?
  end

  private

  def create_mention_notifications
    self.class.mentioned_users(chat_message: @chat_message, creator: @user)
      .each do |target_user|
      if Guardian.new(target_user).can_see_chat_channel?(@chat_channel)
        self.class.create_mention_notification(
          creator_username: @user.username,
          mentioned_user_id: target_user.id,
          chat_channel_id: @chat_channel.id,
          chat_message_id: @chat_message.id,
        )
        self.class.send_push_and_desktop_notifications(
          chat_channel: @chat_channel,
          chat_message: @chat_message,
          mentioned: target_user,
          mentioner: @user
        )
      end
    end
  end

  def self.mentioned_users(chat_message:, creator:)
    mention_matches = chat_message.message.scan(MENTION_REGEX)
    mention_matches.reject! { |match| ["@#{creator.username}", "@system"].include?(match) }
    User
      .includes(:do_not_disturb_timings) # Avoid n+1 for push notifications
      .where(username: mention_matches.map { |match| match[1..-1] })
  end

  def self.create_mention_notification(creator_username:, mentioned_user_id:, chat_channel_id:, chat_message_id:)
    Notification.create!(
      notification_type: Notification.types[:chat_mention],
      user_id: mentioned_user_id,
      high_priority: true,
      data: {
        message: 'chat.mention_notification',
        chat_message_id: chat_message_id,
        chat_channel_id: chat_channel_id,
        mentioned_by_username: creator_username,
      }.to_json
    )
  end

  def self.send_push_and_desktop_notifications(chat_channel:, chat_message:, mentioned:, mentioner:)
    return if mentioned.do_not_disturb?

    payload = {
      notification_type: Notification.types[:chat_mention],
      topic_title: I18n.t("chat.notifications.mention", username: mentioner.username),
      username: mentioned.username,
      post_url: "/chat/channel/#{chat_channel.title(mentioned)}?messageId=#{chat_message.id}"
    }

    MessageBus.publish("/notification-alert/#{mentioned.id}", payload, user_ids: [mentioned.id])
    if mentioned.push_subscriptions.exists?
      Jobs.enqueue(:send_push_notification, user_id: mentioned.id, payload: payload)
    end
  end
end
