# frozen_string_literal: true

module ChatPublisher
  def self.publish_new!(chat_channel, chat_message, staged_id)
    content = ChatMessageSerializer.new(chat_message, { scope: anonymous_guardian, root: :chat_message }).as_json
    content[:type] = :sent
    content[:stagedId] = staged_id
    permissions = permissions(chat_channel)
    MessageBus.publish("/chat/#{chat_channel.id}", content.as_json, permissions)
    MessageBus.publish("/chat/#{chat_channel.id}/new-messages", { message_id: chat_message.id, user_id: chat_message.user_id }, permissions)
  end

  def self.publish_processed!(chat_message)
    chat_channel = chat_message.chat_channel
    content = {
      type: :processed,
      chat_message: {
        id: chat_message.id,
        cooked: chat_message.cooked
      }
    }
    MessageBus.publish("/chat/#{chat_channel.id}", content.as_json, permissions(chat_channel))
  end

  def self.publish_edit!(chat_channel, chat_message)
    content = ChatMessageSerializer.new(chat_message, { scope: anonymous_guardian, root: :chat_message }).as_json
    content[:type] = :edit
    MessageBus.publish("/chat/#{chat_channel.id}", content.as_json, permissions(chat_channel))
  end

  def self.publish_reaction!(chat_channel, chat_message, action, user, emoji)
    content = {
      action: action,
      user: BasicUserSerializer.new(user, root: false).as_json,
      emoji: emoji,
      type: :reaction,
      chat_message_id: chat_message.id
    }
    MessageBus.publish("/chat/message-reactions/#{chat_message.id}", content.as_json, permissions(chat_channel))
    MessageBus.publish("/chat/#{chat_channel.id}", content.as_json, permissions(chat_channel))
  end

  def self.publish_presence!(chat_channel, user, typ)
    raise NotImplementedError
  end

  def self.publish_delete!(chat_channel, chat_message)
    MessageBus.publish(
      "/chat/#{chat_channel.id}",
      { type: "delete", deleted_id: chat_message.id, deleted_at: chat_message.deleted_at },
      permissions(chat_channel)
    )
  end

  def self.publish_bulk_delete!(chat_channel, deleted_message_ids)
    MessageBus.publish(
      "/chat/#{chat_channel.id}",
      { typ: "bulk_delete", deleted_ids: deleted_message_ids, deleted_at: Time.zone.now },
      permissions(chat_channel)
    )
  end

  def self.publish_restore!(chat_channel, chat_message)
    content = ChatMessageSerializer.new(chat_message, { scope: anonymous_guardian, root: :chat_message }).as_json
    content[:type] = :restore
    MessageBus.publish("/chat/#{chat_channel.id}", content.as_json, permissions(chat_channel))
  end

  def self.publish_flag!(chat_message, user, reviewable)
    # Publish to user who created flag
    MessageBus.publish(
      "/chat/#{chat_message.chat_channel_id}",
      {
        type: "self_flagged",
        user_flag_status: ReviewableScore.statuses[:pending],
        chat_message_id: chat_message.id
      }.as_json,
      user_ids: [user.id]
    )

    # Publish flag with link to reviewable to staff
    MessageBus.publish(
      "/chat/#{chat_message.chat_channel_id}",
      {
        type: "flag",
        chat_message_id: chat_message.id,
        reviewable_id: reviewable.id
      }.as_json,
      group_ids: [Group::AUTO_GROUPS[:staff]]
    )
  end

  def self.publish_user_tracking_state(user, chat_channel_id, chat_message_id)
    MessageBus.publish(
      "/chat/user-tracking-state/#{user.id}",
      { chat_channel_id: chat_channel_id, chat_message_id: chat_message_id.to_i }.as_json,
       user_ids: [user.id]
    )
  end

  def self.publish_new_mention(user_id, chat_channel_id, chat_message_id)
    MessageBus.publish("/chat/#{chat_channel_id}/new-mentions", { message_id: chat_message_id }.as_json, user_ids: [user_id])
  end

  def self.publish_new_direct_message_channel(chat_channel, users)
    users.each do |user|
      content = ChatChannelSerializer.new(
        chat_channel,
        scope: Guardian.new(user), # We need a guardian here for direct messages
        root: :chat_channel
      )
      MessageBus.publish("/chat/new-direct-message-channel", content.as_json, user_ids: [user.id])
    end
  end

  def self.publish_chat_changed_for_topic(topic_id)
    MessageBus.publish("/topic/#{topic_id}", reload_topic: true)
  end

  def self.publish_inaccessible_mentions(user_id, chat_message, cannot_chat_users, without_membership)
    MessageBus.publish("/chat/#{chat_message.chat_channel_id}", {
        type: :mention_warning,
        chat_message_id: chat_message.id,
        cannot_see: ActiveModel::ArraySerializer.new(cannot_chat_users, each_serializer: BasicUserSerializer).as_json,
        without_membership: ActiveModel::ArraySerializer.new(without_membership, each_serializer: BasicUserSerializer).as_json,
      },
      user_ids: [user_id]
    )
  end

  def self.publish_chat_channel_edit(chat_channel, acting_user)
    MessageBus.publish("/chat/channel-edits", {
        chat_channel_id: chat_channel.id,
        name: chat_channel.title(acting_user),
        description: chat_channel.description,
      },
      permissions(chat_channel)
    )
  end

  def self.publish_channel_status(chat_channel)
    MessageBus.publish(
      "/chat/channel-status",
      {
        chat_channel_id: chat_channel.id,
        status: chat_channel.status
      },
      permissions(chat_channel)
    )
  end

  def self.publish_archive_status(
    chat_channel, archive_status:, archived_messages:, archive_topic_id:, total_messages:
  )
    MessageBus.publish(
      "/chat/channel-archive-status",
      {
        chat_channel_id: chat_channel.id,
        archive_failed: archive_status == :failed,
        archive_completed: archive_status == :success,
        archived_messages: archived_messages,
        total_messages: total_messages,
        archive_topic_id: archive_topic_id
      },
      permissions(chat_channel)
    )
  end

  private

  def self.permissions(chat_channel)
    { user_ids: chat_channel.allowed_user_ids, group_ids: chat_channel.allowed_group_ids }
  end

  def self.anonymous_guardian
    Guardian.new(nil)
  end
end
