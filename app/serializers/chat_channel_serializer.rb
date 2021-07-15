# frozen_string_literal: true

class ChatChannelSerializer < ApplicationSerializer
  attributes :id,
             :chatable_id,
             :chatable_type,
             :chatable_url,
             :title

  def chatable_url
    object.chatable_type != DiscourseChat::SITE_CHAT_TYPE ?
      object.chatable.url :
      Discourse.base_url
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
end
