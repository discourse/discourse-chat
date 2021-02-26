# frozen_string_literal: true

class TopicChatPublisher

  def publish_new!(msg)
    content = TopicChatMessageSerializer.new(msg, { scope: anonymous_guardian }).as_json
    MessageBus.publish("/chat/#{topic.id}", {
      typ: 'sent',
      msg: content,
    })
  end

  def publish_presence!(topic, user, typ)
    raise NotImplementedError
  end

  def publish_delete!(msg)
    raise NotImplementedError
  end

  def publish_index!
    raise NotImplementedError
    MessageBus.publish("/chat-index", nil)
  end

  def publish_flag!(msg)
    raise NotImplementedError
  end

  private

  def anonymous_guardian
    Guardian.new(nil)
  end
end
