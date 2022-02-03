# frozen_string_literal: true

require_dependency 'reviewable_serializer'

class ReviewableChatMessageSerializer < ReviewableSerializer
  has_one :chat_message, serializer: ChatBaseMessageSerializer, root: false, embed: :objects
  has_one :chat_channel, serializer: ChatChannelSerializer, root: false, ombed: :objects
  # has_one :user, serializer: BasicUserSerializer, root: false, embed: :objects

  def chat_channel
    object.target.chat_channel
  end

  def chat_message
    object.target
  end
end
