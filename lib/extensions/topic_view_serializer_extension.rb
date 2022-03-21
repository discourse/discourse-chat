# frozen_string_literal: true

module DiscourseChat::TopicViewSerializerExtension
  def self.prepended(base)
    base.has_one :chat_channel, serializer: ChatChannelSerializer, root: false, embed: :objects
    base.attribute :has_chat_live
  end

  def has_chat_live
    chat_channel.open? || chat_channel.closed?
  end

  def include_has_chat_live?
    chat_channel.present?
  end

  def chat_channel
    @chat_channel ||= object.topic.chat_channel
  end
end
