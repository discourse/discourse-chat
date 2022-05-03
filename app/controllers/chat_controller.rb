# frozen_string_literal: true

class DiscourseChat::ChatController < DiscourseChat::ChatBaseController
  PAST_MESSAGE_LIMIT = 20
  FUTURE_MESSAGE_LIMIT = 40
  PAST = 'past'
  FUTURE = 'future'
  BOTH = 'both'
  CHAT_DIRECTIONS = [PAST, FUTURE, BOTH]

  before_action :find_chatable, only: [:enable_chat, :disable_chat]
  before_action :find_chat_message, only: [
    :delete,
    :restore,
    :lookup_message,
    :edit_message,
    :rebake,
    :message_link
  ]

  def respond
    render
  end

  def enable_chat
    chat_channel = ChatChannel.with_deleted.find_by(chatable: @chatable)
    if chat_channel && chat_channel.trashed?
      chat_channel.recover!
    elsif chat_channel
      return render_json_error I18n.t("chat.already_enabled")
    else
      chat_channel = ChatChannel.new(chatable: @chatable)
    end

    success = chat_channel.save
    if success && chat_channel.chatable_has_custom_fields?
      @chatable.custom_fields[DiscourseChat::HAS_CHAT_ENABLED] = true
      @chatable.save!

      create_action_whisper(@chatable, 'enabled') if chat_channel.topic_channel?
    end

    if success
      membership = UserChatChannelMembership.find_or_initialize_by(
        chat_channel: chat_channel,
        user: current_user
      )
      membership.following = true
      membership.save!
      if chat_channel.topic_channel?
        ChatPublisher.publish_chat_changed_for_topic(@chatable.id)
      end
      render_serialized(chat_channel, ChatChannelSerializer)
    else
      render_json_error(chat_channel)
    end
  end

  def disable_chat
    chat_channel = ChatChannel.with_deleted.find_by(chatable: @chatable)
    if chat_channel.trashed?
      return render json: success_json
    end
    chat_channel.trash!(current_user)

    success = chat_channel.save
    if success
      if chat_channel.chatable_has_custom_fields?
        @chatable.custom_fields.delete(DiscourseChat::HAS_CHAT_ENABLED)
        @chatable.save!
      end

      if chat_channel.topic_channel?
        create_action_whisper(@chatable, 'disabled')
        ChatPublisher.publish_chat_changed_for_topic(@chatable.id)
      end
      render json: success_json
    else
      render_json_error(chat_channel)
    end
  end

  def create_message
    DiscourseChat::ChatMessageRateLimiter.run!(current_user)

    set_channel_and_chatable
    @user_chat_channel_membership = UserChatChannelMembership.find_by(
      chat_channel: @chat_channel,
      user: current_user,
      following: true
    )
    raise Discourse::InvalidAccess unless @user_chat_channel_membership

    reply_to_msg_id = params[:in_reply_to_id]
    if reply_to_msg_id
      rm = ChatMessage.find(reply_to_msg_id)
      raise Discourse::NotFound if rm.chat_channel_id != @chat_channel.id
    end

    content = params[:message]

    chat_message_creator = DiscourseChat::ChatMessageCreator.create(
      chat_channel: @chat_channel,
      user: current_user,
      in_reply_to_id: reply_to_msg_id,
      content: content,
      staged_id: params[:staged_id],
      upload_ids: params[:upload_ids]
    )

    if chat_message_creator.failed?
      return render_json_error(chat_message_creator.error)
    end

    @chat_channel.touch(:last_message_sent_at)
    @user_chat_channel_membership.update(
      last_read_message_id: chat_message_creator.chat_message.id
    )

    if @chat_channel.direct_message_channel?
      @chat_channel.user_chat_channel_memberships.update_all(following: true)
      ChatPublisher.publish_new_direct_message_channel(@chat_channel, @chat_channel.chatable.users)
    end

    ChatPublisher.publish_user_tracking_state(
      current_user,
      @chat_channel.id,
      chat_message_creator.chat_message.id
    )
    render json: success_json
  end

  def edit_message
    guardian.ensure_can_edit_chat!(@message)
    chat_message_updater = DiscourseChat::ChatMessageUpdater.update(
      chat_message: @message,
      new_content: params[:new_message],
      upload_ids: params[:upload_ids] || []
    )

    if chat_message_updater.failed?
      return render_json_error(chat_message_updater.error)
    end

    render json: success_json
  end

  def update_user_last_read
    set_channel_and_chatable
    set_user_last_read

    render json: success_json
  end

  def messages
    set_channel_and_chatable
    page_size = params[:page_size]&.to_i || 1000
    direction = params[:direction].to_s
    message_id = params[:message_id]
    if page_size > 50 || (message_id.blank? ^ direction.blank? && (direction.present? && !CHAT_DIRECTIONS.include?(direction)))
      raise Discourse::InvalidParameters
    end

    messages = preloaded_chat_message_query.where(chat_channel: @chat_channel)
    messages = messages.with_deleted if guardian.can_moderate_chat?(@chatable)

    if message_id.present?
      condition = [PAST, BOTH].include?(direction) ? '<' : '>'
      messages = messages.where("id #{condition} ?", message_id.to_i)
    end

    order = :desc
    order = :asc if direction == FUTURE
    messages = messages.order(id: order).limit(page_size).to_a

    can_load_more_past = nil
    can_load_more_future = nil

    if direction == FUTURE
      can_load_more_future = messages.size == page_size
    elsif direction == PAST
      can_load_more_past = messages.size == page_size
    elsif direction == BOTH
      can_load_more_past = messages.size == page_size
      can_load_more_future = true
    else
      # When direction is blank, we'll return the latest messages.
      can_load_more_future = false
      can_load_more_past = messages.size == page_size
    end

    chat_view = ChatView.new(
      chat_channel: @chat_channel,
      chat_messages: direction == FUTURE ? messages : messages.reverse,
      user: current_user,
      can_load_more_past: can_load_more_past,
      can_load_more_future: can_load_more_future
    )
    render_serialized(chat_view, ChatViewSerializer, root: false)
  end

  def react
    params.require([:message_id, :emoji, :react_action])
    set_channel_and_chatable
    guardian.ensure_can_react!

    DiscourseChat::ChatMessageReactor.new(
      current_user, @chat_channel
    ).react!(
      message_id: params[:message_id],
      react_action: params[:react_action].to_sym,
      emoji: params[:emoji]
    )

    render json: success_json
  end

  def delete
    set_channel_and_chatable
    guardian.ensure_can_delete_chat!(@message, @chatable)

    updated = @message.trash!(current_user)
    if updated
      ChatPublisher.publish_delete!(@chat_channel, @message)
      render json: success_json
    else
      render_json_error(@message)
    end
  end

  def restore
    chat_channel = @message.chat_channel
    guardian.ensure_can_restore_chat!(@message, chat_channel.chatable)
    updated = @message.recover!
    if updated
      ChatPublisher.publish_restore!(chat_channel, @message)
      render json: success_json
    else
      render_json_error(@message)
    end
  end

  def rebake
    guardian.ensure_can_rebake_chat_message!(@message)
    @message.rebake!(invalidate_oneboxes: true)
    render json: success_json
  end

  def message_link
    return render_404 if @message.blank? || @message.deleted_at.present?
    return render_404 if @message.chat_channel.blank?
    guardian.ensure_can_see!(@message.chat_channel.chatable)
    render json: success_json.merge(
      chat_channel_id: @message.chat_channel.id,
      chat_channel_title: @message.chat_channel.title(current_user)
    )
  end

  def lookup_message
    chat_channel = @message.chat_channel
    chatable = chat_channel.chatable
    guardian.ensure_can_see!(chatable)

    messages = preloaded_chat_message_query.where(chat_channel: chat_channel)
    messages = messages.with_deleted if guardian.can_moderate_chat?(chatable)
    past_messages = messages
      .where("created_at < ?", @message.created_at)
      .order(created_at: :desc)
      .limit(PAST_MESSAGE_LIMIT)

    future_messages = messages
      .where("created_at > ?", @message.created_at)
      .order(created_at: :asc)
      .limit(FUTURE_MESSAGE_LIMIT)

    can_load_more_past = past_messages.count == PAST_MESSAGE_LIMIT
    can_load_more_future = future_messages.count == FUTURE_MESSAGE_LIMIT
    messages = [past_messages.reverse, [@message], future_messages].reduce([], :concat)
    chat_view = ChatView.new(
      chat_channel: chat_channel,
      chat_messages: messages,
      user: current_user,
      can_load_more_past: can_load_more_past,
      can_load_more_future: can_load_more_future
    )
    render_serialized(chat_view, ChatViewSerializer, root: false)
  end

  def set_user_chat_status
    params.require(:chat_enabled)

    current_user.user_option.update(chat_enabled: params[:chat_enabled])
    render json: { chat_enabled: current_user.user_option.chat_enabled }
  end

  def invite_users
    params.require(:user_ids)

    set_channel_and_chatable
    users = User
      .includes(:groups)
      .joins(:user_option)
      .where(user_options: { chat_enabled: true })
      .not_suspended
      .where(id: params[:user_ids])
    users.each do |user|
      guardian = Guardian.new(user)
      if guardian.can_chat?(user) && guardian.can_see_chat_channel?(@chat_channel)
        data = {
          message: 'chat.invitation_notification',
          chat_channel_id: @chat_channel.id,
          chat_channel_title: @chat_channel.title(user),
          invited_by_username: current_user.username,
        }
        if params[:chat_message_id]
          data[:chat_message_id] = params[:chat_message_id]
        end
        user.notifications.create(
          notification_type: Notification.types[:chat_invitation],
          high_priority: true,
          data: data.to_json
        )
      end
    end

    render json: success_json
  end

  def dismiss_retention_reminder
    params.require(:chatable_type)
    guardian.ensure_can_chat!(current_user)
    raise Discourse::InvalidParameters unless ChatChannel.chatable_types.include?(params[:chatable_type])

    field = ChatChannel.public_channel_chatable_types.include?(params[:chatable_type]) ?
      :dismissed_channel_retention_reminder :
      :dismissed_dm_retention_reminder
    current_user.user_option.update(field => true)
    render json: success_json
  end

  def quote_messages
    params.require(:message_ids)

    @chat_channel = ChatChannel.find_by(id: params[:chat_channel_id])
    raise Discourse::NotFound if @chat_channel.blank?
    raise Discourse::InvalidAccess if !guardian.can_see_chat_channel?(@chat_channel)

    message_ids = params[:message_ids].map(&:to_i)
    markdown = ChatTranscriptService.new(@chat_channel, messages_or_ids: message_ids).generate_markdown
    render json: success_json.merge(markdown: markdown)
  end

  def flag
    params.require([:chat_message_id])
    chat_message = ChatMessage
      .includes(:chat_channel)
      .find_by(id: params[:chat_message_id])

    raise Discourse::InvalidParameters unless chat_message
    guardian.ensure_can_flag_chat_message!(chat_message)

    if chat_message.reviewable_score_for(current_user).exists?
      return render json: success_json # Already flagged
    end

    reviewable = chat_message.add_flag(current_user)
    ChatPublisher.publish_flag!(chat_message, current_user, reviewable)
    render json: success_json
  end

  def set_draft
    channel_id = params.require(:channel_id)

    if params[:data].present?
      ChatDraft
        .find_or_initialize_by(user: current_user, chat_channel_id: channel_id)
        .update(data: params[:data])
    else
      ChatDraft
        .where(user: current_user, chat_channel_id: channel_id)
        .destroy_all
    end

    render json: success_json
  end

  private

  def preloaded_chat_message_query
    ChatMessage
      .includes(in_reply_to: [:user, chat_webhook_event: [:incoming_chat_webhook]])
      .includes(:revisions)
      .includes(:user)
      .includes(chat_webhook_event: :incoming_chat_webhook)
      .includes(reactions: :user)
      .includes(:uploads)
      .includes(chat_channel: :chatable)
  end

  def set_user_last_read
    UserChatChannelMembership
      .where(user: current_user, chat_channel: @chat_channel)
      .update_all(last_read_message_id: params[:message_id])

    chat_mentions = ChatMention
      .joins(:notification)
      .joins(:chat_message)
      .where(user: current_user)
      .where(chat_message: { chat_channel_id: @chat_channel.id })
      .where(notification: { read: false })

    chat_mentions.each do |chat_mention|
      chat_mention.notification.update(read: true)
    end

    ChatPublisher.publish_user_tracking_state(
      current_user,
      @chat_channel.id,
      params[:message_id]
    )
  end

  def find_chatable
    chatable_class = case params[:chatable_type].downcase
                     when "topic" then Topic
                     when "category" then Category
                     when "tag" then Tag
    end
    @chatable = chatable_class.find_by(id: params[:chatable_id])

    guardian.ensure_can_see!(@chatable)
    guardian.ensure_can_moderate_chat!(@chatable)
  end

  def find_chat_message
    @message = ChatMessage
      .unscoped
      .includes(chat_channel: :chatable)
      .find_by(id: params[:message_id])

    raise Discourse::NotFound unless @message
  end

  def create_action_whisper(topic, action)
    topic.add_moderator_post(
        current_user,
        nil,
        bump: false,
        post_type: Post.types[:whisper],
        action_code: "chat.#{action}",
        custom_fields: { "action_code_who" => current_user.username }
      )
  end
end
