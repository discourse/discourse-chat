# frozen_string_literal: true

class Chat::ChatController < Chat::ChatBaseController
  PAST_MESSAGE_LIMIT = 20
  FUTURE_MESSAGE_LIMIT = 40
  PAST = "past"
  FUTURE = "future"
  CHAT_DIRECTIONS = [PAST, FUTURE]

  # Other endpoints use set_channel_and_chatable_with_access_check, but
  # these endpoints require a standalone find because they need to be
  # able to get deleted channels and recover them.
  before_action :find_chatable, only: %i[enable_chat disable_chat]
  before_action :find_chat_message,
                only: %i[delete restore lookup_message edit_message rebake message_link]
  before_action :set_channel_and_chatable_with_access_check,
                except: %i[
                  respond
                  enable_chat
                  disable_chat
                  message_link
                  lookup_message
                  set_user_chat_status
                  dismiss_retention_reminder
                  flag
                ]

  def respond
    render
  end

  def enable_chat
    chat_channel = ChatChannel.with_deleted.find_by(chatable: @chatable)

    guardian.ensure_can_see_chat_channel!(chat_channel) if chat_channel

    if chat_channel && chat_channel.trashed?
      chat_channel.recover!
    elsif chat_channel
      return render_json_error I18n.t("chat.already_enabled")
    else
      chat_channel = @chatable.chat_channel
      guardian.ensure_can_see_chat_channel!(chat_channel)
    end

    success = chat_channel.save
    if success && chat_channel.chatable_has_custom_fields?
      @chatable.custom_fields[Chat::HAS_CHAT_ENABLED] = true
      @chatable.save!
    end

    if success
      membership = Chat::ChatChannelMembershipManager.new(channel).follow(user)
      render_serialized(chat_channel, ChatChannelSerializer, membership: membership)
    else
      render_json_error(chat_channel)
    end

    Chat::ChatChannelMembershipManager.new(channel).follow(user)
  end

  def disable_chat
    chat_channel = ChatChannel.with_deleted.find_by(chatable: @chatable)
    guardian.ensure_can_see_chat_channel!(chat_channel)
    return render json: success_json if chat_channel.trashed?
    chat_channel.trash!(current_user)

    success = chat_channel.save
    if success
      if chat_channel.chatable_has_custom_fields?
        @chatable.custom_fields.delete(Chat::HAS_CHAT_ENABLED)
        @chatable.save!
      end

      render json: success_json
    else
      render_json_error(chat_channel)
    end
  end

  def create_message
    raise Discourse::InvalidAccess if current_user.silenced?

    Chat::ChatMessageRateLimiter.run!(current_user)

    @user_chat_channel_membership =
      Chat::ChatChannelMembershipManager.new(@chat_channel).find_for_user(
        current_user,
        following: true,
      )
    raise Discourse::InvalidAccess unless @user_chat_channel_membership

    reply_to_msg_id = params[:in_reply_to_id]
    if reply_to_msg_id
      rm = ChatMessage.find(reply_to_msg_id)
      raise Discourse::NotFound if rm.chat_channel_id != @chat_channel.id
    end

    content = params[:message]

    chat_message_creator =
      Chat::ChatMessageCreator.create(
        chat_channel: @chat_channel,
        user: current_user,
        in_reply_to_id: reply_to_msg_id,
        content: content,
        staged_id: params[:staged_id],
        upload_ids: params[:upload_ids],
      )

    return render_json_error(chat_message_creator.error) if chat_message_creator.failed?

    @chat_channel.touch(:last_message_sent_at)
    @user_chat_channel_membership.update(last_read_message_id: chat_message_creator.chat_message.id)

    if @chat_channel.direct_message_channel?
      # If any of the channel users is ignoring, muting, or preventing DMs from
      # the current user then we shold not auto-follow the channel once again or
      # publish the new channel.
      user_ids_allowing_communication =
        UserCommScreener.new(
          acting_user: current_user,
          target_user_ids: @chat_channel.user_chat_channel_memberships.pluck(:user_id),
        ).allowing_actor_communication

      if user_ids_allowing_communication.any?
        @chat_channel
          .user_chat_channel_memberships
          .where(user_id: user_ids_allowing_communication)
          .update_all(following: true)
        ChatPublisher.publish_new_channel(
          @chat_channel,
          @chat_channel.chatable.users.where(id: user_ids_allowing_communication),
        )
      end
    end

    ChatPublisher.publish_user_tracking_state(
      current_user,
      @chat_channel.id,
      chat_message_creator.chat_message.id,
    )
    render json: success_json
  end

  def edit_message
    guardian.ensure_can_edit_chat!(@message)
    chat_message_updater =
      Chat::ChatMessageUpdater.update(
        chat_message: @message,
        new_content: params[:new_message],
        upload_ids: params[:upload_ids] || [],
      )

    return render_json_error(chat_message_updater.error) if chat_message_updater.failed?

    render json: success_json
  end

  def update_user_last_read
    membership =
      Chat::ChatChannelMembershipManager.new(@chat_channel).find_for_user(
        current_user,
        following: true,
      )
    raise Discourse::NotFound if membership.nil?

    if membership.last_read_message_id && params[:message_id].to_i < membership.last_read_message_id
      raise Discourse::InvalidParameters.new(:message_id)
    end

    unless ChatMessage.with_deleted.exists?(
             chat_channel_id: @chat_channel.id,
             id: params[:message_id],
           )
      raise Discourse::NotFound
    end

    membership.update!(last_read_message_id: params[:message_id])

    Notification
      .where(notification_type: Notification.types[:chat_mention])
      .where(user: current_user)
      .where(read: false)
      .joins("INNER JOIN chat_mentions ON chat_mentions.notification_id = notifications.id")
      .joins("INNER JOIN chat_messages ON chat_mentions.chat_message_id = chat_messages.id")
      .where("chat_messages.id <= ?", params[:message_id].to_i)
      .where("chat_messages.chat_channel_id = ?", @chat_channel.id)
      .update_all(read: true)

    ChatPublisher.publish_user_tracking_state(current_user, @chat_channel.id, params[:message_id])

    render json: success_json
  end

  def messages
    page_size = params[:page_size]&.to_i || 1000
    direction = params[:direction].to_s
    message_id = params[:message_id]
    if page_size > 50 ||
         (
           message_id.blank? ^ direction.blank? &&
             (direction.present? && !CHAT_DIRECTIONS.include?(direction))
         )
      raise Discourse::InvalidParameters
    end

    messages = preloaded_chat_message_query.where(chat_channel: @chat_channel)
    messages = messages.with_deleted if guardian.can_moderate_chat?(@chatable)

    if message_id.present?
      condition = direction == PAST ? "<" : ">"
      messages = messages.where("id #{condition} ?", message_id.to_i)
    end

    # NOTE: This order is reversed when we return the ChatView below if the direction
    # is not FUTURE.
    order = direction == FUTURE ? "ASC" : "DESC"
    messages = messages.order("created_at #{order}, id #{order}").limit(page_size).to_a

    can_load_more_past = nil
    can_load_more_future = nil

    if direction == FUTURE
      can_load_more_future = messages.size == page_size
    elsif direction == PAST
      can_load_more_past = messages.size == page_size
    else
      # When direction is blank, we'll return the latest messages.
      can_load_more_future = false
      can_load_more_past = messages.size == page_size
    end

    chat_view =
      ChatView.new(
        chat_channel: @chat_channel,
        chat_messages: direction == FUTURE ? messages : messages.reverse,
        user: current_user,
        can_load_more_past: can_load_more_past,
        can_load_more_future: can_load_more_future,
      )
    render_serialized(chat_view, ChatViewSerializer, root: false)
  end

  def react
    params.require(%i[message_id emoji react_action])
    guardian.ensure_can_react!

    Chat::ChatMessageReactor.new(current_user, @chat_channel).react!(
      message_id: params[:message_id],
      react_action: params[:react_action].to_sym,
      emoji: params[:emoji],
    )

    render json: success_json
  end

  def delete
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
    set_channel_and_chatable_with_access_check(chat_channel_id: @message.chat_channel_id)
    render json:
             success_json.merge(
               chat_channel_id: @chat_channel.id,
               chat_channel_title: @chat_channel.title(current_user),
             )
  end

  def lookup_message
    set_channel_and_chatable_with_access_check(chat_channel_id: @message.chat_channel_id)

    messages = preloaded_chat_message_query.where(chat_channel: @chat_channel)
    messages = messages.with_deleted if guardian.can_moderate_chat?(@chatable)

    past_messages =
      messages
        .where("created_at < ?", @message.created_at)
        .order(created_at: :desc)
        .limit(PAST_MESSAGE_LIMIT)

    future_messages =
      messages
        .where("created_at > ?", @message.created_at)
        .order(created_at: :asc)
        .limit(FUTURE_MESSAGE_LIMIT)

    can_load_more_past = past_messages.count == PAST_MESSAGE_LIMIT
    can_load_more_future = future_messages.count == FUTURE_MESSAGE_LIMIT
    messages = [past_messages.reverse, [@message], future_messages].reduce([], :concat)
    chat_view =
      ChatView.new(
        chat_channel: @chat_channel,
        chat_messages: messages,
        user: current_user,
        can_load_more_past: can_load_more_past,
        can_load_more_future: can_load_more_future,
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

    users =
      User
        .includes(:groups)
        .joins(:user_option)
        .where(user_options: { chat_enabled: true })
        .not_suspended
        .where(id: params[:user_ids])
    users.each do |user|
      guardian = Guardian.new(user)
      if guardian.can_chat?(user) && guardian.can_see_chat_channel?(@chat_channel)
        data = {
          message: "chat.invitation_notification",
          chat_channel_id: @chat_channel.id,
          chat_channel_title: @chat_channel.title(user),
          invited_by_username: current_user.username,
        }
        data[:chat_message_id] = params[:chat_message_id] if params[:chat_message_id]
        user.notifications.create(
          notification_type: Notification.types[:chat_invitation],
          high_priority: true,
          data: data.to_json,
        )
      end
    end

    render json: success_json
  end

  def dismiss_retention_reminder
    params.require(:chatable_type)
    guardian.ensure_can_chat!(current_user)
    unless ChatChannel.chatable_types.include?(params[:chatable_type])
      raise Discourse::InvalidParameters
    end

    field =
      (
        if ChatChannel.public_channel_chatable_types.include?(params[:chatable_type])
          :dismissed_channel_retention_reminder
        else
          :dismissed_dm_retention_reminder
        end
      )
    current_user.user_option.update(field => true)
    render json: success_json
  end

  def quote_messages
    params.require(:message_ids)

    message_ids = params[:message_ids].map(&:to_i)
    markdown =
      ChatTranscriptService.new(
        @chat_channel,
        current_user,
        messages_or_ids: message_ids,
      ).generate_markdown
    render json: success_json.merge(markdown: markdown)
  end

  def move_messages_to_channel
    params.require(:message_ids)
    params.require(:destination_channel_id)

    raise Discourse::InvalidAccess if !guardian.can_move_chat_messages?(@chat_channel)
    destination_channel =
      Chat::ChatChannelFetcher.find_with_access_check(params[:destination_channel_id], guardian)

    begin
      message_ids = params[:message_ids].map(&:to_i)
      moved_messages =
        Chat::MessageMover.new(
          acting_user: current_user,
          source_channel: @chat_channel,
          message_ids: message_ids,
        ).move_to_channel(destination_channel)
    rescue Chat::MessageMover::NoMessagesFound, Chat::MessageMover::InvalidChannel => err
      return render_json_error(err.message)
    end

    render json:
             success_json.merge(
               destination_channel_id: destination_channel.id,
               destination_channel_title: destination_channel.title(current_user),
               first_moved_message_id: moved_messages.first.id,
             )
  end

  def flag
    RateLimiter.new(current_user, "flag_chat_message", 4, 1.minutes).performed!

    permitted_params =
      params.permit(
        %i[chat_message_id flag_type_id message is_warning take_action queue_for_review],
      )

    chat_message =
      ChatMessage.includes(:chat_channel, :revisions).find(permitted_params[:chat_message_id])

    flag_type_id = permitted_params[:flag_type_id].to_i

    if !ReviewableScore.types.values.include?(flag_type_id)
      raise Discourse::InvalidParameters.new(:flag_type_id)
    end

    set_channel_and_chatable_with_access_check(chat_channel_id: chat_message.chat_channel_id)

    result =
      Chat::ChatReviewQueue.new.flag_message(chat_message, guardian, flag_type_id, permitted_params)

    if result[:success]
      render json: success_json
    else
      render_json_error(result[:errors])
    end
  end

  def set_draft
    if params[:data].present?
      ChatDraft.find_or_initialize_by(user: current_user, chat_channel_id: @chat_channel.id).update(
        data: params[:data],
      )
    else
      ChatDraft.where(user: current_user, chat_channel_id: @chat_channel.id).destroy_all
    end

    render json: success_json
  end

  private

  def preloaded_chat_message_query
    query =
      ChatMessage
        .includes(in_reply_to: [:user, chat_webhook_event: [:incoming_chat_webhook]])
        .includes(:revisions)
        .includes(:user)
        .includes(chat_webhook_event: :incoming_chat_webhook)
        .includes(reactions: :user)
        .includes(:bookmarks)
        .includes(:uploads)
        .includes(chat_channel: :chatable)

    query = query.includes(user: :user_status) if SiteSetting.enable_user_status

    query
  end

  def find_chatable
    @chatable = Category.find_by(id: params[:chatable_id])
    guardian.ensure_can_moderate_chat!(@chatable)
  end

  def find_chat_message
    @message = preloaded_chat_message_query.with_deleted
    @message = @message.where(chat_channel_id: params[:chat_channel_id]) if params[:chat_channel_id]
    @message = @message.find_by(id: params[:message_id])
    raise Discourse::NotFound unless @message
  end
end
