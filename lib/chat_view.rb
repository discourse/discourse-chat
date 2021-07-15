# frozen_string_literal: true

class ChatView
  attr_reader :chat_channel, :chatable, :messages, :message_bus_last_id

  def initialize(chat_channel:, chatable:, messages:, message_bus_last_id:)
    @chat_channel = chat_channel
    @chatable = chatable
    @message_bus_last_id = message_bus_last_id || ChatPublisher.last_id(chatable)
    @messages = messages
  end
end
