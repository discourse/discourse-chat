# frozen_string_literal: true

class DiscourseChat::ChatController < ::ApplicationController
  before_action :ensure_logged_in
  before_action :ensure_can_chat
  before_action :find_chatable, only: [:enable_chat, :disable_chat]
  before_action :find_chat_message, only: [
    :delete,
    :restore,
    :lookup_message,
    :edit_message
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
    if success
      @chatable.custom_fields[DiscourseChat::HAS_CHAT_ENABLED] = true
      @chatable.save!

      create_action_whisper(@chatable, 'enabled') if chat_channel.topic_channel?
    end
    success ? (render json: success_json) : render_json_error(chat_channel)
  end

  def disable_chat
    chat_channel = ChatChannel.with_deleted.find_by(chatable: @chatable)
    if chat_channel.trashed?
      return render_json_error I18n.t("chat.already_disabled")
    end
    chat_channel.trash!(current_user)

    success = chat_channel.save
    if success &&
      @chatable.custom_fields.delete(DiscourseChat::HAS_CHAT_ENABLED)
      @chatable.save!

      create_action_whisper(@chatable, 'disabled') if chat_channel.topic_channel?
    end
    success ? (render json: success_json) : (render_json_error(chat_channel))
  end

  def create_message
    set_channel_and_chatable

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
      staged_id: params[:stagedId]
    )

    if chat_message_creator.failed?
      return render_json_error(chat_message_creator.error)
    end

    @chat_channel.touch
    set_user_last_read
    render json: success_json
  end

  def edit_message
    guardian.ensure_can_edit_chat!(@message)
    chat_message_updater = DiscourseChat::ChatMessageUpdater.update(
      chat_message: @message,
      new_content: params[:new_message],
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
    if (params[:page_size]&.to_i || 1000) > 50
      raise Discourse::InvalidParameters
    end

    # n.b.: must fetch ID before querying DB
    messages = ChatMessage
      .includes(:in_reply_to)
      .includes(:revisions)
      .includes(chat_webhook_event: :incoming_chat_webhook)
      .where(chat_channel: @chat_channel)

    if params[:before_message_id]
      messages = messages.where("id < ?", params[:before_message_id])
    end

    messages = messages.order(created_at: :desc).limit(params[:page_size])

    if @chat_channel.site_channel? || guardian.can_moderate_chat?(@chatable)
      messages = messages.with_deleted
    end

    # Reverse messages so they are in the correct order. Need the order on the query with the
    # limit to fetch the correct messages.
    messages = messages.to_a.reverse
    chat_view = ChatView.new(
      chat_channel: @chat_channel,
      chatable: @chatable,
      messages: messages
    )
    render_serialized(chat_view, ChatViewSerializer, root: :topic_chat_view)
  end

  def delete
    chat_channel = @message.chat_channel

    if chat_channel.site_channel?
      guardian.ensure_can_access_site_chat!
    else
      chatable = chat_channel.chatable
      guardian.ensure_can_see!(chatable)
      guardian.ensure_can_delete_chat!(@message, chatable)
    end

    updated = @message.update(deleted_at: Time.now, deleted_by_id: current_user.id)
    if updated
      ChatPublisher.publish_delete!(chat_channel, @message)
      render json: success_json
    else
      render_json_error(@message)
    end
  end

  def restore
    chat_channel = @message.chat_channel

    if chat_channel.site_channel?
      guardian.ensure_can_access_site_chat!
    else
      guardian.ensure_can_restore_chat!(@message, chat_channel.chatable)
    end

    updated = @message.update(deleted_at: nil, deleted_by_id: nil)
    if updated
      ChatPublisher.publish_restore!(chat_channel, @message)
      render json: success_json
    else
      render_json_error(@message)
    end
  end

  def flag
    render_json_error "unimplemented"
  end

  def index
    structured = DiscourseChat::ChatChannelFetcher.structured(guardian)
    render_serialized(structured, ChatChannelIndexSerializer, root: false)
  end

  def channel_details
    set_channel_and_chatable
    render_serialized(@chat_channel, ChatChannelSerializer)
  end

  def lookup_message
    chat_channel = @message.chat_channel
    chatable = nil
    if chat_channel.site_channel?
      include_deleted = true
      guardian.ensure_can_access_site_chat!
    else
      chatable = chat_channel.chatable
      guardian.ensure_can_see!(chatable)
      include_deleted = guardian.can_moderate_chat?(chatable)
    end

    past_messages = ChatMessage
      .where(chat_channel: chat_channel)
      .where("created_at < ?", @message.created_at)
      .order(created_at: :desc).limit(20)
    past_messages = past_messages.with_deleted if include_deleted

    # .with_deleted if include_deleted
    future_messages = ChatMessage
      .where(chat_channel: chat_channel)
      .where("created_at > ?", @message.created_at)
      .order(created_at: :asc)
    future_messages = future_messages.with_deleted if include_deleted

    messages = [past_messages.reverse, [@message], future_messages].reduce([], :concat)

    chat_view = ChatView.new(
      chat_channel: chat_channel,
      chatable: chatable,
      messages: messages
    )
    render_serialized(chat_view, ChatViewSerializer, root: :topic_chat_view)
  end

  private

  def set_user_last_read
    UserChatChannelLastRead
      .where(user: current_user, chat_channel: @chat_channel)
      .update_all(chat_message_id: params[:message_id])

    ChatPublisher.publish_user_tracking_state(
      current_user,
      @chat_channel.id,
      params[:message_id]
    )
  end

  def set_channel_and_chatable(with_trashed: false)
    chat_channel_query = ChatChannel
    if with_trashed
      chat_channel_query = chat_channel.with_deleted
    end

    @chat_channel = chat_channel_query.find_by(id: params[:chat_channel_id])
    raise Discourse::NotFound unless @chat_channel

    @chatable = nil
    if @chat_channel.site_channel?
      guardian.ensure_can_access_site_chat!
    else
      @chatable = @chat_channel.chatable
      guardian.ensure_can_see!(@chatable)
    end
  end

  def find_chatable
    @chatable = params[:chatable_type].downcase == "topic" ?
      Topic.find(params[:chatable_id]) :
      Category.find(params[:chatable_id])

    guardian.ensure_can_see!(@chatable)
    guardian.ensure_can_moderate_chat!(@chatable)
  end

  def find_chat_message
    @message = ChatMessage
      .unscoped
      .includes(:chat_channel)
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

  def ensure_can_chat
    guardian.ensure_can_chat!(current_user)
  end
end
