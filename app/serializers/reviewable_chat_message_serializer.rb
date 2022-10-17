# frozen_string_literal: true

require_dependency "reviewable_serializer"

class ReviewableChatMessageSerializer < ReviewableSerializer
  has_one :chat_message, serializer: ChatMessageSerializer, root: false, embed: :objects
  has_one :chat_channel, serializer: ChatChannelSerializer, root: false, embed: :objects

  payload_attributes :transcript_topic_id, :message_cooked

  def chat_channel
    object.chat_message.chat_channel
  end

  def chat_message
    object.chat_message
  end
end
