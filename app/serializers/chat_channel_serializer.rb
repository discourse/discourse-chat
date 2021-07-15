# frozen_string_literal: true

class ChatChannelSerializer < ApplicationSerializer
  attributes :id,
             :chatable_id,
             :chatable_type,
             :chatable_url,
             :title

  def chatable_url
    object.chatable.url
  end

  def title
    object.chatable_type == "Topic" ?
      object.chatable.fancy_title :
      object.chatable.name
  end
end
