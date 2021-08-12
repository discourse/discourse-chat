# frozen_string_literal: true

class DirectMessageChannelSerializer < ApplicationSerializer
  has_many :users, serializer: BasicUserSerializer, embed: :objects

  def users
    object.direct_message_users.map(&:user) - [scope.user]
  end
end
