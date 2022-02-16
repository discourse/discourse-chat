# frozen_string_literal: true

class ChatInReplyToSerializer < ApplicationSerializer
  has_one :user, serializer: BasicUserSerializer, embed: :objects

  attributes :id, :cooked, :excerpt
end
