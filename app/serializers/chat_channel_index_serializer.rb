# frozen_string_literal: true

class ChatChannelIndexSerializer < ApplicationSerializer
  attributes :global_presence_channel_state, :public_channels, :direct_message_channels

  def public_channels
    object[:public_channels].map do |channel|
      ChatChannelSerializer.new(channel, root: nil, scope: scope, membership: channel_membership(channel.id))
    end
  end

  def direct_message_channels
    object[:direct_message_channels].map do |channel|
      ChatChannelSerializer.new(channel, root: nil, scope: scope, membership: channel_membership(channel.id))
    end
  end

  def global_presence_channel_state
    PresenceChannelStateSerializer.new(PresenceChannel.new("/chat/online").state, root: nil)
  end

  def channel_membership(channel_id)
    return if scope.anonymous?
    object[:memberships].find { |membership| membership.chat_channel_id == channel_id }
  end
end
