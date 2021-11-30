# frozen_string_literal: true

class DiscourseChat::ChatController < DiscourseChat::ChatBaseController
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
      staged_id: params[:stagedId],
      upload_ids: params[:uploadIds]
    )

    if chat_message_creator.failed?
      return render_json_error(chat_message_creator.error)
    end

    @chat_channel.touch
    @user_chat_channel_membership.update(
      last_read_message_id: chat_message_creator.chat_message.id
    )
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
      new_content: params[:newMessage],
      upload_ids: params[:uploadIds] || []
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
      .includes(:user)
      .includes(chat_webhook_event: :incoming_chat_webhook)
      .includes(:uploads)
      .where(chat_channel: @chat_channel)

    if params[:before_message_id]
      messages = messages.where("id < ?", params[:before_message_id])
    end

    messages = messages.order(created_at: :desc).limit(params[:page_size])

    if guardian.can_moderate_chat?(@chatable)
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
    render_serialized(chat_view, ChatViewSerializer, root: :chat_view)
  end

  def delete
    chat_channel = @message.chat_channel
    chatable = chat_channel.chatable
    guardian.ensure_can_see!(chatable)
    guardian.ensure_can_delete_chat!(@message, chatable)

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
    guardian.ensure_can_restore_chat!(@message, chat_channel.chatable)
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

  def lookup_message
    chat_channel = @message.chat_channel
    chatable = nil
    chatable = chat_channel.chatable
    guardian.ensure_can_see!(chatable)
    include_deleted = guardian.can_moderate_chat?(chatable)
    base_query = ChatMessage
      .includes(:in_reply_to)
      .includes(:revisions)
      .includes(:user)
      .includes(chat_webhook_event: :incoming_chat_webhook)
      .includes(:uploads)
      .includes(chat_channel: :chatable)
      .where(chat_channel: chat_channel)

    base_query = base_query.with_deleted if include_deleted
    past_messages = base_query
      .where("created_at < ?", @message.created_at)
      .order(created_at: :desc).limit(40)

    # .with_deleted if include_deleted
    future_messages = base_query
      .where("created_at > ?", @message.created_at)
      .order(created_at: :asc)

    messages = [past_messages.reverse, [@message], future_messages].reduce([], :concat)
    chat_view = ChatView.new(
      chat_channel: chat_channel,
      chatable: chatable,
      messages: messages
    )
    render_serialized(chat_view, ChatViewSerializer, root: :chat_view)
  end

  def set_user_chat_status
    params.require(:chat_enabled)

    current_user.user_option.update(chat_enabled: params[:chat_enabled])
    render json: { chat_enabled: current_user.user_option.chat_enabled }
  end

  private

  def set_user_last_read
    UserChatChannelMembership
      .where(user: current_user, chat_channel: @chat_channel)
      .update_all(last_read_message_id: params[:message_id])

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
end
