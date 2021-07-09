# frozen_string_literal: true

require_dependency "application_controller"

class DiscourseChat::ChatController < ::ApplicationController
  requires_plugin DiscourseChat::PLUGIN_NAME
  before_action :ensure_logged_in, only: [:send_chat, :delete]
  before_action :find_chat_message, only: [:delete]
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

    # safeguard against unusual topic archetypes
    return render_json_error('chat.no_regular_posts') unless chat_channel.last_regular_post.presence

    success = chat_channel.save
    if success && chat_channel.chatable_type == "Topic"
      create_action_whisper(@chatable, 'enabled')
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
    if success && chat_channel.chatable_type == "Topic"
      create_action_whisper(@chatable, 'disabled') if success
    end
    success ? (render json: success_json) : (render_json_error(chat_channel))
  end

  def send_chat
    chat_channel = ChatChannel.includes(:chatable).find(params[:chat_channel_id])
    raise Discourse::NotFound unless chat_channel

    chatable = chat_channel.chatable
    if chat_channel.chatable_type == "Topic"
      raise Discourse::NotFound unless guardian.can_see?(chatable)
    else
      # TODO: Secure with category guardian
    end

    guardian.ensure_can_chat!(current_user)

    post_id = params[:post_id]
    if post_id
      raise Discourse::NotFound if Post.find(post_id).topic_id != chatable.id
    end

    reply_to_msg_id = params[:in_reply_to_id]
    if reply_to_msg_id
      rm = ChatMessage.find(reply_to_msg_id)
      raise Discourse::NotFound if rm.chat_channel_id != chat_channel.id
      post_id = rm.post_id
    end

    post_id ||= ChatChannel.last_regular_post(chatable).id
    content = params[:message]

    msg = ChatMessage.new(
      chat_channel: chat_channel,
      post_id: post_id,
      user_id: current_user.id,
      in_reply_to_id: reply_to_msg_id,
      message: content,
    )
    if !msg.save
      return render_json_error(msg)
    end

    ChatPublisher.publish_new!(chat_channel, msg)
    render json: success_json
  end

  def recent
    chat_channel = ChatChannel.includes(:chatable).find(params[:chat_channel_id])
    raise Discourse::NotFound unless chat_channel

    chatable = chat_channel.chatable
    if chat_channel.chatable_type == "Topic"
      raise Discourse::NotFound unless guardian.can_see?(chatable)
    else
      # TODO: Secure with category guardian
    end

    # n.b.: must fetch ID before querying DB
    message_bus_last_id = ChatPublisher.last_id(chat_channel)
    messages = ChatMessage.where(chat_channel: chat_channel).order(created_at: :desc).limit(50)
    # TODO: Make sure `can_moderator_chat` checks type
    if guardian.can_moderate_chat?(chatable)
      messages = messages.with_deleted
    end

    render_serialized(ChatView.new(chatable, messages, message_bus_last_id), ChatViewSerializer, root: :topic_chat_view)
  end

  def historical
    chat_channel = ChatChannel
      .includes(:chatable)
      .with_deleted
      .find(params[:chat_channel_id])
    raise Discourse::NotFound unless chat_channel

    chatable = chat_channel.chatable
    if chat_channel.chatable_type == "Topic"
      raise Discourse::NotFound unless guardian.can_see?(chatable)
    else
      # TODO: Secure with category guardian
    end

    post_id = params[:post_id]
    p = Post.find(post_id)
    raise Discourse::NotFound if p.topic_id != t.id

    render_json_error "unimplemented"
  end

  def delete
    chat_channel = @message.chat_channel
    chatable = @message.chat_channel.chatable
    if chatable.class.name == "Topic"
      raise Discourse::NotFound unless guardian.can_see?(chatable)
      raise Discourse::NotFound unless guardian.can_delete_chat?(@message, chatable)
    else
      # TODO: Secure with category guardian
    end

    updated = @message.update(deleted_at: Time.now, deleted_by_id: current_user.id)
    if updated
      ChatPublisher.publish_delete!(chat_channel, @message)
      render json: success_json
    else
      render_json_error(@message)
    end
  end

  def flag
    render_json_error "unimplemented"
  end

  def index
    # channels = ChatChannel.joins(:topic).merge(Topic.secured(Guardian.new(current_user)))
    channels = ChatChannel.all # SECURE THIS

    render_serialized(channels, ChatChannelSerializer)
  end

  private

  def find_chatable
    if params[:chatable_type].downcase == "topic"
      @chatable = Topic.find(params[:chatable_id])
      guardian.ensure_can_see!(@chatable)
      guardian.ensure_can_enable_chat!(@chatable)
    else
      @chatable = Category.find(params[:chatable_id])
      # TODO: Secure with category guardian
    end
  end

  def find_chat_message
    @message = ChatMessage.find_by(id: params[:message_id])

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
