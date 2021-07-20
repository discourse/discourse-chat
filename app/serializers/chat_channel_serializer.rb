# frozen_string_literal: true

class ChatChannelSerializer < ApplicationSerializer
  attributes :id,
             :chatable_id,
             :chatable_type,
             :chatable_url,
             :title,
             :chatable

  has_many :chat_channels, serializer: ChatChannelSerializer, embed: :objects

  def chatable_url
    object.site_channel? ?
      Discourse.base_url :
      object.chatable.url
  end

  def title
    case object.chatable_type
    when "Topic"
      object.chatable.fancy_title
    when "Category"
      object.chatable.name
    when "Site"
      I18n.t("chat.site_chat_name")
    end
  end

  def chatable
    return nil if object.site_channel?
    return BasicTopicSerializer.new(object.chatable, root: false).as_json if object.topic_channel?
    BasicCategorySerializer.new(object.chatable, root: false).as_json
  end
end
