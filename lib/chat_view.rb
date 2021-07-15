# frozen_string_literal: true

class ChatView
  attr_reader :chatable, :messages, :message_bus_last_id

  def initialize(chatable, messages, message_bus_last_id)
    @chatable = chatable
    @message_bus_last_id = message_bus_last_id || ChatPublisher.last_id(chatable)
    @messages = messages
  end

end
