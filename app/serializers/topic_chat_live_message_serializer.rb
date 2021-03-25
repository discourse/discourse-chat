# frozen_string_literal: true

class TopicChatLiveMessageSerializer < TopicChatBaseMessageSerializer
  has_one :user, serializer: BasicUserSerializer, root: :users
end
