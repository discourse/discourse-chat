# frozen_string_literal: true

class ChatViewSerializer < ApplicationSerializer
  attributes :meta, :chat_messages

  def chat_messages
    ActiveModel::ArraySerializer.new(
      object.chat_messages,
      each_serializer: ChatMessageSerializer,
      reviewable_ids: object.reviewable_ids,
      user_flag_statuses: object.user_flag_statuses,
      scope: scope
    )
  end

  def meta
    meta_hash = {
      can_flag: scope.can_flag_in_chat_channel?(object.chat_channel),
    }
    meta_hash[:can_load_more_past] = object.can_load_more_past unless object.can_load_more_past.nil?
    meta_hash[:can_load_more_future] = object.can_load_more_future unless object.can_load_more_future.nil?
    meta_hash
  end
end
