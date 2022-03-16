# frozen_string_literal: true
class DiscourseChat::ChatMessageCreator
  attr_reader :error, :chat_message

  def self.create(opts)
    instance = new(**opts)
    instance.create
    instance
  end

  def self.attach_uploads(chat_message_id, uploads)
    return if uploads.blank?

    now = Time.now
    record_attrs = uploads.map do |upload|
      {
        upload_id: upload.id,
        chat_message_id: chat_message_id,
        created_at: now,
        updated_at: now
      }
    end
    ChatUpload.insert_all!(record_attrs)
  end

  def initialize(chat_channel:, in_reply_to_id: nil, user:, content:, staged_id: nil, incoming_chat_webhook: nil, upload_ids: nil)
    @chat_channel = chat_channel
    @user = user
    @guardian = Guardian.new(user)
    @in_reply_to_id = in_reply_to_id
    @content = content
    @staged_id = staged_id
    @incoming_chat_webhook = incoming_chat_webhook
    @upload_ids = upload_ids || []
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
      validate_channel_status!
      validate_message!
      @chat_message.cook
      @chat_message.save!
      create_chat_webhook_event
      attach_uploads
      ChatDraft.where(user_id: @user.id, chat_channel_id: @chat_channel.id).destroy_all
      ChatPublisher.publish_new!(@chat_channel, @chat_message, @staged_id)
      Jobs.enqueue(:process_chat_message, { chat_message_id: @chat_message.id })
      DiscourseChat::ChatNotifier.notify_new(chat_message: @chat_message, timestamp: @chat_message.created_at)
    rescue => error
      @error = error
    end
  end

  def failed?
    @error.present?
  end

  private

  def validate_user_permissions!
    return if @guardian.can_create_chat_message!
    raise StandardError.new(
      I18n.t("chat.errors.user_cannot_send_message")
    )
  end

  def validate_channel_status!
    return if @guardian.can_create_channel_message?(@chat_channel)
    raise StandardError.new(
      I18n.t("chat.errors.channel_new_message_disallowed", status: @chat_channel.status_name)
    )
  end

  def validate_message!
    @chat_message.validate_message
    if @chat_message.errors.present?
      raise StandardError.new(@chat_message.errors.map(&:full_message).join(", "))
    end
  end

  def create_chat_webhook_event
    return if @incoming_chat_webhook.blank?
    ChatWebhookEvent.create(
      chat_message: @chat_message,
      incoming_chat_webhook: @incoming_chat_webhook
    )
  end

  def attach_uploads
    return if @upload_ids.blank? || !SiteSetting.chat_allow_uploads

    uploads = Upload.where(id: @upload_ids, user_id: @user.id)
    self.class.attach_uploads(@chat_message.id, uploads)
  end
end
