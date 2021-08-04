# frozen_string_literal: true

module ChatPublisher
  def self.last_id(chat_channel)
    MessageBus.last_id("/chat/#{chat_channel.id}")
  end

  def self.publish_new!(chat_channel, msg)
    content = ChatBaseMessageSerializer.new(msg, { scope: anonymous_guardian, root: :topic_chat_message }).as_json
    content[:typ] = :sent
    MessageBus.publish("/chat/#{chat_channel.id}", content.as_json)
    MessageBus.publish("/chat/#{chat_channel.id}/new_messages", { message_id: msg.id, user_id: msg.user_id })
  end

  def self.publish_edit!(chat_channel, msg)
    content = ChatBaseMessageSerializer.new(msg, { scope: anonymous_guardian, root: :topic_chat_message }).as_json
    content[:typ] = :edit
    MessageBus.publish("/chat/#{chat_channel.id}", content.as_json)
  end

  def self.publish_presence!(chat_channel, user, typ)
    raise NotImplementedError
  end

  def self.publish_delete!(chat_channel, msg)
    MessageBus.publish("/chat/#{chat_channel.id}", { typ: "delete", deleted_id: msg.id, deleted_at: msg.deleted_at })
  end

  def self.publish_restore!(chat_channel, msg)
    content = ChatBaseMessageSerializer.new(msg, { scope: anonymous_guardian, root: :topic_chat_message }).as_json
    content[:typ] = :restore
    MessageBus.publish("/chat/#{chat_channel.id}", content.as_json)
  end

  def self.publish_flag!(msg)
    raise NotImplementedError
  end

  private

  def self.anonymous_guardian
    Guardian.new(nil)
  end
end
