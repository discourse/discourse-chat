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
      @chat_message.cook
      @chat_message.save!
      save_revision!
      update_uploads!
      update_mention_notifications
      ChatPublisher.publish_edit!(@chat_channel, @chat_message)
      Jobs.enqueue(:process_chat_message, { chat_message_id: @chat_message.id })
    rescue => error
      puts error.inspect
      @error = error
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

  def update_mention_notifications
    existing_notifications = Notification
      .where(notification_type: Notification.types[:chat_mention])
      .where("data LIKE ?", "%\"chat_message_id\":#{@chat_message.id}%")

    already_notified_user_ids = existing_notifications.map(&:user_id)
    mentioned_user_ids = DiscourseChat::ChatMessageCreator.
      mentioned_users(chat_message: @chat_message, creator: @user)
      .map(&:id)

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
      if Guardian.new(target_user).can_see_chat_channel?(@chat_channel)
        DiscourseChat::ChatMessageCreator.create_mention_notification(
          creator_username: @user.username,
          mentioned_user: target_user,
          chat_channel: @chat_channel,
          chat_message: @chat_message,
        )
      end
    }
  end
end
