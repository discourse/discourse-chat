# frozen_string_literal: true

class ChatChannelSerializer < ApplicationSerializer
  attributes :id,
             :chatable_id,
             :chatable_type,
             :title

  def title
    object.chatable_type == "Topic" ?
      object.chatable.fancy_title :
      object.chatable.name
  end
end
