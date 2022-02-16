# frozen_string_literal: true

class ChatViewSerializer < ApplicationSerializer
  attributes :meta, :chat_messages

  def chat_messages
    ActiveModel::ArraySerializer.new(
      object.messages,
      each_serializer: ChatMessageSerializer,
      reviewable_ids: object.reviewable_ids,
      user_flag_statuses: object.user_flag_statuses,
      scope: scope
    )
  end

  def meta
    {
      can_flag: scope.can_flag_in_chat_channel?(object.chat_channel)
    }
  end
end
