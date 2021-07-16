class DiscourseChat::ChatMessageCreator
  MENTION_REGEX = /\@\w+/
  attr_reader :error

  def self.create(opts)
    instance = new(opts)
    instance.create
    instance
  end

  def initialize(chat_channel:, post_id: nil, in_reply_to_id: nil, user:, content:)
    @chat_channel = chat_channel
    @post_id = post_id
    @user = user
    @in_reply_to_id = in_reply_to_id
    @content = content
    @error = nil

    @chat_message = ChatMessage.new(
      chat_channel: @chat_channel,
      post_id: @post_id,
      user_id: @user.id,
      in_reply_to_id: @in_reply_to_id,
      message: @content,
    )
  end

  def create
    begin
      save_message
      create_mention_notifications
      ChatPublisher.publish_new!(@chat_channel, @chat_message)
    rescue => error
      p error.inspect
      @error = error
    end
  end

  def failed?
    @error.present?
  end

  private

  def save_message
    @chat_message.save
    errors = @chat_message
  end

  def create_mention_notifications
    mention_matches = @chat_message.message.scan(MENTION_REGEX)
    mention_matches.reject! { |match| ["@#{@user.username}", "@system"].include?(match) }
    users = User.where(username: mention_matches.map { |match| match[1..-1] })
    users.each { |target_user| create_notification_for(@user, target_user) }
  end

  def create_notification_for(message_creator, mentioned_user)
    Notification.create!(
      notification_type: Notification.types[:custom],
      user_id: mentioned_user.id,
      high_priority: true,
      data: {
        message: 'chat.mention_notification',
        chat_message_id: @chat_message.id,
        display_username: message_creator.username,
        mentioned_by_id: message_creator.id
      }.to_json
    )
  end
end
