# frozen_string_literal: true
class DiscourseChat::ChatMessageCreator
  attr_reader :error, :chat_message

  def self.create(opts)
    instance = new(**opts)
    instance.create
    instance
  end

  def initialize(chat_channel:, in_reply_to_id: nil, user:, content:, staged_id: nil, incoming_chat_webhook: nil, upload_ids: nil)
    @chat_channel = chat_channel
    @user = user
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

    if @incoming_chat_webhook
      ChatWebhookEvent.create(
        chat_message: @chat_message,
        incoming_chat_webhook: @incoming_chat_webhook
      )
    end
  end

  def create
    begin
      @chat_message.cook
      @chat_message.save!
      attach_uploads
      ChatPublisher.publish_new!(@chat_channel, @chat_message, @staged_id)
      Jobs.enqueue(:process_chat_message, { chat_message_id: @chat_message.id })
      Jobs.enqueue(:send_chat_notifications, { type: :new, chat_message_id: @chat_message.id })
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

  def attach_uploads
    return if @upload_ids.blank?

    uploads = Upload.where(id: @upload_ids, user_id: @user.id)
    self.class.attach_uploads(@chat_message.id, uploads)
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
end
