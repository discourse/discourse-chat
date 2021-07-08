# frozen_string_literal: true

require_dependency "application_controller"

class DiscourseChat::ChatController < ::ApplicationController
  requires_plugin DiscourseChat::PLUGIN_NAME
  before_action :ensure_logged_in, only: [:send_chat, :delete]
  before_action :find_chat_message, only: [:delete]

  def enable_chat
    t = Topic.find(params[:topic_id])
    guardian.ensure_can_see!(t)
    guardian.ensure_can_enable_chat!(t)

    success = true

    chat_chanel = ChatChannel.with_deleted.find_by(chatable: t)
    if chat_chanel && chat_chanel.trashed?
      chat_chanel.recover!
    elsif chat_chanel
      return render_json_error I18n.t("chat.already_enabled")
    else
      chat_chanel = ChatChannel.new(chatable: t)
    end

    # safeguard against unusual topic archetypes
    return render_json_error('chat.no_regular_posts') unless chat_chanel.last_regular_post.presence

    success = chat_chanel.save
    create_action_whisper(t, 'enabled_chat') if success
    success ? (render json: success_json) : render_json_error(chat_chanel)
  end

  def disable_chat
    t = Topic.with_deleted.find(params[:topic_id])
    guardian.ensure_can_see!(t)
    guardian.ensure_can_enable_chat!(t)

    chat_channel = ChatChannel.with_deleted.find_by(chatable: t)
    if chat_channel.trashed?
      return render_json_error I18n.t("chat.already_disabled")
    end
    chat_channel.trash!(current_user)

    success = chat_channel.save
    create_action_whisper(t, 'disabled_chat') if success
    success ? (render json: success_json) : (render_json_error(chat_channel))
  end

  def send_chat
    t = Topic.find(params[:topic_id])
    raise Discourse::NotFound unless guardian.can_see?(t)
    chat_channel = ChatChannel.find_by(chatable: t)
    raise Discourse::NotFound unless chat_channel
    guardian.ensure_can_chat!(current_user)

    post_id = params[:post_id]
    if post_id
      raise Discourse::NotFound if Post.find(post_id).topic_id != t.id
    end

    reply_to_msg_id = params[:in_reply_to_id]
    if reply_to_msg_id
      rm = ChatMessage.find(reply_to_msg_id)
      raise Discourse::NotFound if rm.chat_channel_id != chat_channel.id
      post_id = rm.post_id
    end

    post_id ||= ChatChannel.last_regular_post(t).id
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

    ChatPublisher.publish_new!(t, msg)
    render json: success_json
  end

  def recent
    topic = Topic.find(params[:topic_id])
    raise Discourse::NotFound unless guardian.can_see?(topic)
    chat_channel = ChatChannel.find_by(chatable: topic)
    raise Discourse::NotFound unless chat_channel

    # n.b.: must fetch ID before querying DB
    message_bus_last_id = ChatPublisher.last_id(topic)
    messages = ChatMessage.where(chat_channel: chat_channel).order(created_at: :desc).limit(50)
    if guardian.can_moderate_chat?(topic)
      messages = messages.with_deleted
    end

    render_serialized(ChatView.new(topic, messages, message_bus_last_id), ChatViewSerializer, root: :topic_chat_view)
  end

  def historical
    t = Topic.with_deleted.find(params[:topic_id])
    raise Discourse::NotFound unless guardian.can_see?(t)
    chat_channel = ChatChannel.with_deleted.find_by(topic: t)
    raise Discourse::NotFound unless chat_channel

    post_id = params[:post_id]
    p = Post.find(post_id)
    raise Discourse::NotFound if p.topic_id != t.id

    render_json_error "unimplemented"
  end

  def delete
    topic = @message.chat_channel.chatable
    raise Discourse::NotFound unless guardian.can_delete_chat?(@message, topic)

    updated = @message.update(deleted_at: Time.now, deleted_by_id: current_user.id)
    if updated
      ChatPublisher.publish_delete!(topic, @message)
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

  def find_chat_message
    @message = ChatMessage.find_by(id: params[:message_id])

    raise Discourse::NotFound unless @message
  end

  def create_action_whisper(topic, action)
    PostCreator.new(current_user,
                    raw: I18n.t(action),
                    topic_id: topic.id,
                    skip_validations: true,
                    post_type: Post.types[:whisper]
                   ).create
  end
end
