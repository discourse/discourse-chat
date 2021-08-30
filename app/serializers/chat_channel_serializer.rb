# frozen_string_literal: true

class ChatChannelSerializer < ApplicationSerializer
  attributes :id,
             :chatable_id,
             :chatable_type,
             :chatable_url,
             :title,
             :chatable,
             :updated_at

  has_many :chat_channels, serializer: ChatChannelSerializer, embed: :objects

  def chatable_url
    object.chatable_url
  end

  def title
    object.title(scope.user)
  end

  def chatable
    case object.chatable_type
    when "Topic"
      BasicTopicSerializer.new(object.chatable, root: false).as_json
    when "Category"
      BasicCategorySerializer.new(object.chatable, root: false).as_json
    when "DirectMessageChannel"
      DirectMessageChannelSerializer.new(object.chatable, scope: scope, root: false).as_json
    when "Site"
      nil
    end
  end
end
