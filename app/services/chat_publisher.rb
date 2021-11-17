# frozen_string_literal: true

module ChatPublisher
  def self.publish_new!(chat_channel, msg, staged_id)
    content = ChatBaseMessageSerializer.new(msg, { scope: anonymous_guardian, root: :topic_chat_message }).as_json
    content[:typ] = :sent
    content[:stagedId] = staged_id
    permissions = permissions(chat_channel)
    MessageBus.publish("/chat/#{chat_channel.id}", content.as_json, permissions)
    MessageBus.publish("/chat/#{chat_channel.id}/new-messages", { message_id: msg.id, user_id: msg.user_id }, permissions)
  end

  def self.publish_edit!(chat_channel, msg)
    content = ChatBaseMessageSerializer.new(msg, { scope: anonymous_guardian, root: :topic_chat_message }).as_json
    content[:typ] = :edit
    MessageBus.publish("/chat/#{chat_channel.id}", content.as_json, permissions(chat_channel))
  end

  def self.publish_presence!(chat_channel, user, typ)
    raise NotImplementedError
  end

  def self.publish_delete!(chat_channel, msg)
    MessageBus.publish(
      "/chat/#{chat_channel.id}",
      { typ: "delete", deleted_id: msg.id, deleted_at: msg.deleted_at },
      permissions(chat_channel)
    )
  end

  def self.publish_restore!(chat_channel, msg)
    content = ChatBaseMessageSerializer.new(msg, { scope: anonymous_guardian, root: :topic_chat_message }).as_json
    content[:typ] = :restore
    MessageBus.publish("/chat/#{chat_channel.id}", content.as_json, permissions(chat_channel))
  end

  def self.publish_flag!(msg)
    raise NotImplementedError
  end

  def self.publish_user_tracking_state(user, chat_channel_id, chat_message_id)
    MessageBus.publish(
      "/chat/user-tracking-state/#{user.id}",
      { chat_channel_id: chat_channel_id, chat_message_id: chat_message_id.to_i }.as_json,
       user_ids: [user.id]
    )
  end

  def self.publish_new_mention(user, chat_channel_id, chat_message_id)
    MessageBus.publish("/chat/#{chat_channel_id}/new-mentions", { message_id: chat_message_id }.as_json, user_ids: [user.id])
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

  private

  def self.permissions(chat_channel)
    { user_ids: chat_channel.allowed_user_ids, group_ids: chat_channel.allowed_group_ids }
  end

  def self.anonymous_guardian
    Guardian.new(nil)
  end
end
