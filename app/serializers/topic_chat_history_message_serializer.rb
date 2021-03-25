# frozen_string_literal: true

class TopicChatHistoryMessageSerializer < TopicChatBaseMessageSerializer
  has_one :user, serializer: BasicUserSerializer, embed: :objects
end
