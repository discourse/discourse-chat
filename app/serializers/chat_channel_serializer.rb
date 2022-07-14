# frozen_string_literal: true

class ChatChannelSerializer < ApplicationSerializer
  attributes :id,
             :auto_join_users,
             :chatable,
             :chatable_id,
             :chatable_type,
             :chatable_url,
             :description,
             :last_read_message_id,
             :muted,
             :title,
             :unread_count,
             :unread_mentions,
             :last_message_sent_at,
             :status,
             :archive_failed,
             :archive_completed,
             :archived_messages,
             :total_messages,
             :archive_topic_id,
             :memberships_count,
             :desktop_notification_level,
             :mobile_notification_level,
             :following

  def include_description?
    object.description.present?
  end

  def memberships_count
    object.user_count
  end

  def include_muted?
    !object.direct_message_channel?
  end

  def chatable_url
    object.chatable_url
  end

  def title
    object.name || object.title(scope.user)
  end

  def chatable
    case object.chatable_type
    when "Category"
      BasicCategorySerializer.new(object.chatable, root: false).as_json
    when "DirectMessageChannel"
      DirectMessageChannelSerializer.new(object.chatable, scope: scope, root: false).as_json
    when "Site"
      nil
    end
  end

  def archive
    object.chat_channel_archive
  end

  def include_archive_status?
    scope.is_staff? && object.archived? && archive.present?
  end

  def archive_completed
    archive.complete?
  end

  def archive_failed
    archive.failed?
  end

  def archived_messages
    archive.archived_messages
  end

  def total_messages
    archive.total_messages
  end

  def archive_topic_id
    archive.destination_topic_id
  end

  def include_auto_join_users?
    scope.can_edit_chat_channel?
  end

  alias_method :include_archive_topic_id?, :include_archive_status?
  alias_method :include_total_messages?, :include_archive_status?
  alias_method :include_archived_messages?, :include_archive_status?
  alias_method :include_archive_failed?, :include_archive_status?
  alias_method :include_archive_completed?, :include_archive_status?
end
