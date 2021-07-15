# frozen_string_literal: true

class DiscourseChat::ChatController < ::ApplicationController
  before_action :ensure_logged_in
  before_action :ensure_can_chat
  before_action :find_chat_message, only: [:delete, :restore]
  before_action :find_chatable, only: [:enable_chat, :disable_chat]

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

  def send_chat
    set_channel_and_chatable

    post_id = params[:post_id]
    if post_id
      raise Discourse::NotFound if Post.find(post_id).topic_id != @chatable.id
    end

    reply_to_msg_id = params[:in_reply_to_id]
    if reply_to_msg_id
      rm = ChatMessage.find(reply_to_msg_id)
      raise Discourse::NotFound if rm.chat_channel_id != @chat_channel.id
      post_id = rm.post_id
    end

    if @chat_channel.topic_channel?
      post_id ||= ChatChannel.last_regular_post(@chatable)&.id
    end

    content = params[:message]

    msg = ChatMessage.new(
      chat_channel: @chat_channel,
      post_id: post_id,
      user_id: current_user.id,
      in_reply_to_id: reply_to_msg_id,
      message: content,
    )
    if !msg.save
      return render_json_error(msg)
    end

    ChatPublisher.publish_new!(@chat_channel, msg)
    render json: success_json
  end

  def recent
    set_channel_and_chatable

    # n.b.: must fetch ID before querying DB
    message_bus_last_id = ChatPublisher.last_id(@chat_channel)
    messages = ChatMessage.where(chat_channel: @chat_channel).order(created_at: :desc).limit(50)

    # If chatable is nil and we are here, we can assume it is site-chat and authenticated.
    if @chatable.nil? || guardian.can_moderate_chat?(@chatable)
      messages = messages.with_deleted
    end

    render_serialized(ChatView.new(@chatable, messages, message_bus_last_id), ChatViewSerializer, root: :topic_chat_view)
  end

  def historical
    set_channel_and_chatable(with_trashed: true)

    post_id = params[:post_id]
    p = Post.find(post_id)
    raise Discourse::NotFound if p.topic_id != t.id

    render_json_error "unimplemented"
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
    channels = ChatChannel.includes(:chatable).where(chatable_type: ["Topic", "Category"]).all
    channels = channels.to_a.select do |channel|
      if channel.topic_channel?
        !channel.chatable.closed && !channel.chatable.archived && guardian.can_see_topic?(channel.chatable)
      else
        guardian.can_see_category?(channel.chatable)
      end
    end
    if current_user.staff?
      channels.prepend(ChatChannel.find_by(chatable_id: DiscourseChat::SITE_CHAT_ID))
    end

    render_serialized(channels, ChatChannelSerializer)
  end

  private

  def set_channel_and_chatable(with_trashed: false)
    chat_channel_query = ChatChannel
    if with_trashed
      chat_channel_query = chat_channel.with_deleted
    end

    @chat_channel = chat_channel_query.find_by(id: params[:chat_channel_id])
    raise Discourse::NotFound unless @chat_channel

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
