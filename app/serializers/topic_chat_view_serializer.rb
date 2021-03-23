# frozen_string_literal: true

class TopicChatViewSerializer < ApplicationSerializer
  attributes :last_id
  has_many :messages, serializer: TopicChatMessageSerializer, embed: :objects

  def last_id
    object.message_bus_last_id
  end
end
