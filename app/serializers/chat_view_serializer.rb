# frozen_string_literal: true

class ChatViewSerializer < ApplicationSerializer
  attributes :last_id,
    :can_chat,
    :can_flag,
    :can_delete_self,
    :can_delete_others

  has_many :messages, serializer: ChatHistoryMessageSerializer, embed: :objects

  def last_id
    object.message_bus_last_id
  end

  def can_chat
    scope.can_chat_in_chatable?(object.chatable)
  end

  def can_flag
    scope.can_flag_chats?
  end

  def can_delete_self
    scope.can_delete_own_chats?(object.chatable)
  end

  def can_delete_others
    scope.can_delete_other_chats?(object.chatable)
  end
end
