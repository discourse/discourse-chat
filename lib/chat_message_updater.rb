# frozen_string_literal: true
class DiscourseChat::ChatMessageUpdater
  attr_reader :error

  def self.update(opts)
    instance = new(**opts)
    instance.update
    instance
  end

  def initialize(chat_message:, new_content:, upload_ids: nil)
    @chat_message = chat_message
    @old_message_content = chat_message.message
    @chat_channel = @chat_message.chat_channel
    @user = @chat_message.user
    @new_content = new_content
    @upload_ids = upload_ids
    @error = nil
  end

  def update
    begin
      @chat_message.message = @new_content
      validate_message!
      @chat_message.cook
      @chat_message.save!
      revision = save_revision!
      update_uploads!
      ChatPublisher.publish_edit!(@chat_channel, @chat_message)
      Jobs.enqueue(:process_chat_message, { chat_message_id: @chat_message.id })
      DiscourseChat::ChatNotifier.notify_edit(chat_message: @chat_message, timestamp: revision.created_at)
    rescue => error
      @error = error
    end
  end

  def validate_message!
    @chat_message.validate_message
    if @chat_message.errors.present?
      raise StandardError.new(@chat_message.errors.map(&:full_message).join(", "))
    end
  end

  def failed?
    @error.present?
  end

  private

  def update_uploads!
    return if @upload_ids.nil?

    uploads = Upload.where(id: @upload_ids, user_id: @user.id)
    return unless uploads.count == @upload_ids.count

    validate_upload_ids = uploads.map(&:id)
    existing_upload_ids = @chat_message.upload_ids
    difference = (existing_upload_ids + validate_upload_ids) - (existing_upload_ids & validate_upload_ids)
    return if difference.empty?

    ChatUpload.where(chat_message: @chat_message).destroy_all
    DiscourseChat::ChatMessageCreator.attach_uploads(@chat_message.id, uploads)
  end

  def save_revision!
    @chat_message.revisions.create!(old_message: @old_message_content, new_message: @chat_message.message)
  end
end
