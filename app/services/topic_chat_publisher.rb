# frozen_string_literal: true

class TopicChatPublisher

  def self.last_id(topic)
    MessageBus.last_id("/chat/#{topic.id}")
  end

  def self.publish_new!(topic, msg)
    content = TopicChatLiveMessageSerializer.new(msg, { scope: anonymous_guardian, root: :topic_chat_message }).as_json
    content[:typ] = :sent
    MessageBus.publish("/chat/#{topic.id}", content.as_json)
  end

  def self.publish_presence!(topic, user, typ)
    raise NotImplementedError
  end

  def self.publish_delete!(msg)
    raise NotImplementedError
  end

  def self.publish_index!
    raise NotImplementedError
    MessageBus.publish("/chat-index", nil)
  end

  def self.publish_flag!(msg)
    raise NotImplementedError
  end

  private

  def self.anonymous_guardian
    Guardian.new(nil)
  end
end
