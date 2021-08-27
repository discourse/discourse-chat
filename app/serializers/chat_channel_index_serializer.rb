# frozen_string_literal: true

class ChatChannelIndexSerializer < ApplicationSerializer
  has_many :public_channels, serializer: ChatChannelSerializer, embed: :objects
  has_many :direct_message_channels, serializer: ChatChannelSerializer, embed: :objects
  attributes :global_presence_channel_state

  def public_channels
    object[:public_channels]
  end

  def direct_message_channels
    object[:direct_message_channels]
  end

  def global_presence_channel_state
    PresenceChannelStateSerializer.new(PresenceChannel.new("/chat/online").state, root: nil)
  end
end
