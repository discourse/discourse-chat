# frozen_string_literal: true

class TopicChatChannelSerializer < ApplicationSerializer
  attributes :topic_id,
             :title

  def title
    object.topic.fancy_title
  end
end
