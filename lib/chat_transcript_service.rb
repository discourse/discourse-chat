# frozen_string_literal: true

class ChatTranscriptService
  CHAINED_ATTR = "chained=\"true\""
  MULTIQUOTE_ATTR = "multiQuote=\"true\""

  def initialize(channel, message_ids)
    @channel = channel
    @message_ids = message_ids
  end

  def generate_bbcode
    return single_message if @message_ids.length == 1
  end

  private

  def single_message
    build_bbcode(messages.first, include_channel: true)
  end

  def quote_attr(message)
    "quote=\"#{message.user.username};#{message.id};#{message.created_at.iso8601}\""
  end

  def channel_attr
    "channel=\"#{@channel.name}\""
  end

  def build_bbcode(message, include_channel: false)
    attrs = [quote_attr(message)]

    if include_channel
      attrs << channel_attr
    end

    <<~MARKDOWN
    [chat #{attrs.join(" ")}]
    #{message.message}
    [/chat]
    MARKDOWN
  end

  def messages
    @messages ||= ChatMessage.includes(:user).where(id: @message_ids)
  end
end
