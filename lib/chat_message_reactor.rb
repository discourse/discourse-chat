# frozen_string_literal: true

class DiscourseChat::ChatMessageReactor
  ADD_REACTION = :add
  REMOVE_REACTION = :remove
  MAX_REACTIONS_LIMIT = 30

  def initialize(user, chat_channel)
    @user = user
    @chat_channel = chat_channel
    @guardian = Guardian.new(user)
  end

  def react!(message_id:, react_action:, emoji:)
    if ![ADD_REACTION, REMOVE_REACTION].include?(react_action) || !Emoji.exists?(emoji)
      raise Discourse::InvalidParameters
    end

    validate_channel_membership!
    validate_channel_status!

    @chat_message = ChatMessage.find_by(id: message_id, chat_channel: @chat_channel)
    raise Discourse::NotFound unless @chat_message

    validate_max_reactions!(react_action, emoji)

    execute_action(react_action, emoji)
    publish_reaction(react_action, emoji)

    @chat_message
  end

  private

  def validate_channel_membership!
    raise Discourse::InvalidAccess if !UserChatChannelMembership.exists?(
      chat_channel: @chat_channel,
      user: @user,
      following: true
    )
  end

  def validate_channel_status!
    return if @guardian.can_create_channel_message?(@chat_channel)
    raise Discourse::InvalidAccess.new(
      nil,
      nil,
      custom_message: "chat.errors.channel_modify_message_disallowed",
      custom_message_params: { status: @chat_channel.status_name }
    )
  end

  def validate_max_reactions!(react_action, emoji)
    if react_action == ADD_REACTION &&
      @chat_message.reactions.count('DISTINCT emoji') >= MAX_REACTIONS_LIMIT &&
      !@chat_message.reactions.exists?(emoji: emoji)

      raise Discourse::InvalidAccess.new(
        nil,
        nil,
        custom_message: "chat.errors.max_reactions_limit_reached"
      )
    end
  end

  def execute_action(react_action, emoji)
    if react_action == ADD_REACTION
      @chat_message.reactions.find_or_create_by(user: @user, emoji: emoji)
    else
      @chat_message.reactions.where(user: @user, emoji: emoji).destroy_all
    end
  end

  def publish_reaction(react_action, emoji)
    ChatPublisher.publish_reaction!(
      @chat_channel,
      @chat_message,
      react_action,
      @user,
      emoji
    )
  end
end
