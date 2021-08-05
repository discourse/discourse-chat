# frozen_string_literal: true

class ChatView
  attr_reader :chat_channel, :chatable, :messages

  def initialize(chat_channel:, chatable:, messages:)
    @chat_channel = chat_channel
    @chatable = chatable
    @messages = messages
  end
end
