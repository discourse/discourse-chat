# frozen_string_literal: true

class ChatViewSerializer < ApplicationSerializer
  attributes :can_chat,
             :can_flag,
             :can_delete_self,
             :can_delete_others

  has_many :messages, serializer: ChatBaseMessageSerializer, embed: :objects

  def include_can_flag?
    scope.can_flag_chats?
  end

  def can_flag
    true
  end

  def include_can_delete_self?
    object.chat_channel.site_channel? ||
      scope.can_delete_own_chats?(object.chatable)
  end

  def can_delete_self
    true
  end

  def include_can_delete_others?
    object.chat_channel.site_channel? ||
      scope.can_delete_other_chats?(object.chatable)
  end

  def can_delete_others
    true
  end
end
