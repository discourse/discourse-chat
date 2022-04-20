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
    @guardian = Guardian.new(@user)
    @new_content = new_content
    @upload_ids = upload_ids
    @error = nil
  end

  def update
    begin
      validate_channel_status!
      @chat_message.message = @new_content
      upload_info = get_upload_info
      validate_message!(has_uploads: upload_info[:uploads].any?)
      @chat_message.cook
      @chat_message.save!
      update_uploads(upload_info)
      revision = save_revision!
      ChatPublisher.publish_edit!(@chat_channel, @chat_message)
      Jobs.enqueue(:process_chat_message, { chat_message_id: @chat_message.id })
      mentioned_users_with_identifier = DiscourseChat::ChatNotifier.notify_edit(
        chat_message: @chat_message,
        timestamp: revision.created_at
      )
      update_email_statuses(mentioned_users_with_identifier)
    rescue => error
      @error = error
    end
  end

  def failed?
    @error.present?
  end

  private

  def validate_channel_status!
    return if @guardian.can_modify_channel_message?(@chat_channel)
    raise StandardError.new(
      I18n.t("chat.errors.channel_modify_message_disallowed", status: @chat_channel.status_name)
    )
  end

  def validate_message!(has_uploads:)
    @chat_message.validate_message(has_uploads: has_uploads)
    if @chat_message.errors.present?
      raise StandardError.new(@chat_message.errors.map(&:full_message).join(", "))
    end
  end

  def get_upload_info
    return { uploads: [] } if @upload_ids.nil? || !SiteSetting.chat_allow_uploads

    uploads = Upload.where(id: @upload_ids, user_id: @user.id)
    if uploads.count != @upload_ids.count
      # User is passing upload_ids for uploads that they don't own. Don't change anything.
      return { uploads: @chat_message.uploads, changed: false }
    end

    new_upload_ids = uploads.map(&:id)
    existing_upload_ids = @chat_message.upload_ids
    difference = (existing_upload_ids + new_upload_ids) - (existing_upload_ids & new_upload_ids)
    { uploads: uploads, changed: difference.any? }
  end

  def update_uploads(upload_info)
    return unless upload_info[:changed]

    ChatUpload.where(chat_message: @chat_message).destroy_all
    @chat_message.attach_uploads(upload_info[:uploads])
  end

  def save_revision!
    @chat_message.revisions.create!(old_message: @old_message_content, new_message: @chat_message.message)
  end

  def update_email_statuses(mentioned_users_with_identifier)
    ChatMessageEmailStatus.message_edited(
      chat_channel: @chat_channel,
      chat_message: @chat_message,
      mentioned_users_with_identifier: mentioned_users_with_identifier
    )
  end
end
