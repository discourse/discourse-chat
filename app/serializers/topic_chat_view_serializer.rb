# frozen_string_literal: true

class TopicChatViewSerializer < ApplicationSerializer
  attributes :last_id,
    :can_chat,
    :can_flag,
    :can_delete_self,
    :can_delete_others

  has_many :messages, serializer: TopicChatHistoryMessageSerializer, embed: :objects

  def last_id
    object.message_bus_last_id
  end

  def can_chat
    scope.can_chat_in_topic?(object.topic.topic_chat)
  end

  def can_flag
    scope.can_flag_chats?(object.topic)
  end

  def can_delete_self
    scope.can_delete_own_chats?(object.topic)
  end

  def can_delete_others
    scope.can_delete_other_chats?(object.topic)
  end
end
