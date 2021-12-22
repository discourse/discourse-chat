# frozen_string_literal: true

class ChatChannelSerializer < ApplicationSerializer
  attributes :id,
             :chatable,
             :chatable_id,
             :chatable_type,
             :chatable_url,
             :description,
             :last_read_message_id,
             :muted,
             :title,
             :unread_count,
             :unread_mentions,
             :updated_at

  def include_description?
    !object.description.blank?
  end

  def include_muted?
    !object.direct_message_channel?
  end

  def chatable_url
    object.chatable_url
  end

  def title
    object.name || object.title(scope.user)
  end

  def chatable
    case object.chatable_type
    when "Topic"
      BasicTopicSerializer.new(object.chatable, root: false).as_json
    when "Category"
      BasicCategorySerializer.new(object.chatable, root: false).as_json
    when "Tag"
      TagSerializer.new(object.chatable, root: false).as_json
    when "DirectMessageChannel"
      DirectMessageChannelSerializer.new(object.chatable, scope: scope, root: false).as_json
    when "Site"
      nil
    end
  end
end
