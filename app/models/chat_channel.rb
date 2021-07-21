# frozen_string_literal: true

class ChatChannel < ActiveRecord::Base
  include Trashable
  attribute :chat_channels, default: []

  belongs_to :chatable, polymorphic: true
  has_many :chat_messages

  def topic_channel?
    chatable_type == "Topic"
  end

  def category_channel?
    chatable_type == "Category"
  end

  def site_channel?
    chatable_type == DiscourseChat::SITE_CHAT_TYPE
  end

  def self.is_enabled?(t)
    return false if !SiteSetting.topic_chat_enabled
    ChatChannel.where(chatable: topic).exists?
  end
end
