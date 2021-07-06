# frozen_string_literal: true

class TopicChatChannelSerializer < ApplicationSerializer
  attributes :topic_id,
             :title,
             :url

  def title
    object.topic.fancy_title
  end

  def url
    object.topic.url
  end
end
