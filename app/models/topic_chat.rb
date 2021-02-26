# frozen_string_literal: true

class TopicChat < ActiveRecord::Base
  def self.enabled_on_topic?(t)
    TopicChat.where(topic_id: t.id).exists?
  end
end
