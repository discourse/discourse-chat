# frozen_string_literal: true

class ChatChannelSearchSerializer < ApplicationSerializer
  has_many :users, serializer: BasicUserSerializer, embed: :objects

  def public_channels
    object[:public_channels].map do |channel|
      ChatChannelSerializer.new(channel, root: nil, scope: scope, membership: channel_membership(channel.id))
    end
  end

  def direct_message_channels
    object[:public_channels].map do |channel|
      ChatChannelSerializer.new(channel, root: nil, scope: scope, membership: channel_membership(channel.id))
    end
  end

  def users
    object[:users]
  end

  def channel_membership(channel_id)
    return if scope.anonymous?
    object[:memberships].find { |membership| membership.chat_channel_id == channel_id }
  end
end
