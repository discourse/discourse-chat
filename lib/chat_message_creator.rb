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

  def initialize(chat_channel:, in_reply_to_id: nil, user:, content:)
    @chat_channel = chat_channel
    @user = user
    @in_reply_to_id = in_reply_to_id
    @content = content
    @error = nil

    @chat_message = ChatMessage.new(
      chat_channel: @chat_channel,
      user_id: @user.id,
      in_reply_to_id: @in_reply_to_id,
      message: @content,
    )
  end

  def create
    begin
      @chat_message.save!
      create_mention_notifications
      ChatPublisher.publish_new!(@chat_channel, @chat_message)
    rescue => error
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
      self.class.create_mention_notification(
        creator_username: @user.username,
        mentioned_user_id: target_user.id,
        chat_channel_id: @chat_channel.id,
        chat_message_id: @chat_message.id,
      )
    end
  end

  def self.mentioned_users(chat_message:, creator:)
    mention_matches = chat_message.message.scan(MENTION_REGEX)
    mention_matches.reject! { |match| ["@#{creator.username}", "@system"].include?(match) }
    User.where(username: mention_matches.map { |match| match[1..-1] })
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
end
