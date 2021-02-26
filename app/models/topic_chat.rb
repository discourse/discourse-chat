# frozen_string_literal: true

class TopicChat < ActiveRecord::Base
  include Trashable

  belongs_to :topic

  def self.is_enabled?(t)
    return false if !SiteSetting.topic_chat_enabled
    TopicChat.where(topic_id: t.id).exists?
  end
end
