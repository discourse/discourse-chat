# frozen_string_literal: true

class ChatView
  attr_reader :topic, :messages, :message_bus_last_id

  def initialize(topic, messages, message_bus_last_id)
    @topic = topic
    @message_bus_last_id = message_bus_last_id || ChatPublisher.last_id(topic)
    @messages = messages
  end

end
