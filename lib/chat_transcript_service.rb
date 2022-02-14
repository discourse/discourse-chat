# frozen_string_literal: true

##
# Used to generate BBCode [chat] tags for the message IDs provided.
#
# If there is > 1 message then the channel name will be shown at
# the top of the first message, and subsequent messages will have
# the chained attribute, which will affect how they are displayed
# in the UI.
#
# Subsequent messages from the same user will be put into the same
# tag. Each new user in the chain of messages will have a new [chat]
# tag created.
#
# A single message will have the channel name displayed to the right
# of the username and datetime of the message.
class ChatTranscriptService
  CHAINED_ATTR = "chained=\"true\""
  MULTIQUOTE_ATTR = "multiQuote=\"true\""

  class ChatTranscriptBBCode
    attr_reader :channel, :multiquote, :chained

    def initialize(
      channel: nil,
      multiquote: false,
      chained: false
    )
      @channel = channel
      @multiquote = multiquote
      @chained = chained
      @messages = []
    end

    def <<(message)
      @messages << message
    end

    def render
      attrs = [quote_attr(@messages.first)]
      attrs << channel_attr if channel
      attrs << MULTIQUOTE_ATTR if multiquote
      attrs << CHAINED_ATTR if chained

      <<~MARKDOWN
      [chat #{attrs.join(" ")}]
      #{@messages.map(&:to_markdown).join("\n\n")}
      [/chat]
      MARKDOWN
    end

    private

    def quote_attr(message)
      "quote=\"#{message.user.username};#{message.id};#{message.created_at.iso8601}\""
    end

    def channel_attr
      "channel=\"#{channel.name}\""
    end
  end

  def initialize(channel, message_ids)
    @channel = channel
    @message_ids = message_ids
  end

  def generate_markdown
    previous_message = nil
    rendered_markdown = []
    all_messages_same_user = messages.count(:user_id) == 1
    open_bbcode_tag = ChatTranscriptBBCode.new(
      channel: @channel,
      multiquote: messages.length > 1,
      chained: !all_messages_same_user
    )

    messages.each.with_index do |message, idx|
      if previous_message.present? && previous_message.user_id != message.user_id
        rendered_markdown << open_bbcode_tag.render

        open_bbcode_tag = ChatTranscriptBBCode.new(
          chained: !all_messages_same_user
        )
      end

      open_bbcode_tag << message
      previous_message = message
    end

    # tie off the last open bbcode + render
    rendered_markdown << open_bbcode_tag.render
    rendered_markdown.join("\n")
  end

  private

  def messages
    @messages ||= ChatMessage.includes(:user, :uploads).where(
      id: @message_ids, chat_channel_id: @channel.id
    ).order(:created_at)
  end
end
