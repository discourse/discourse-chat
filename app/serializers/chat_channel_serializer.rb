# frozen_string_literal: true

class ChatChannelSerializer < ApplicationSerializer
  attributes :chatable_id,
             :title

  def title
    object.chatable.fancy_title
  end
end
