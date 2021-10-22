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
      staged_id: params[:stagedId]
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
      .includes(:user)
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
    base_query = ChatMessage
      .includes(:in_reply_to)
      .includes(:revisions)
      .includes(:user)
      .includes(chat_webhook_event: :incoming_chat_webhook)

    unless chat_channel.site_channel?
      base_query = base_query.includes(chat_channel: :chatable)
    end

    base_query = base_query.where(chat_channel: chat_channel)
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
    render_serialized(chat_view, ChatViewSerializer, root: :topic_chat_view)
  end

  def set_user_chat_status
    params.require(:chat_enabled)

    current_user.user_option.update(chat_enabled: params[:chat_enabled])
    render json: { chat_enabled: current_user.user_option.chat_enabled }
  end

  def move_to_topic
    raise Discourse::NotFound unless SiteSetting.topic_chat_enabled

    params.require([:type, :chat_message_ids, :chat_channel_id])
    chat_channel = ChatChannel.find_by(id: params[:chat_channel_id])
    if chat_channel.nil? || !guardian.can_see_chat_channel?(chat_channel)
      raise Discourse::InvalidParameters.new(:chat_channel_id)
    end

    chat_messages = ChatMessage.includes(:user).where(id: params[:chat_message_ids]).order(:id)
    raise Discourse::InvalidParameters.new("Must include at least one chat message id") if chat_messages.empty?

    first_chat_message = chat_messages.first
    last_user_id = first_chat_message.user_id
    post_attributes = [{
      user: first_chat_message.user,
      raw: first_chat_message.message,
      chat_message_ids: [first_chat_message.id]
    }]

    # Consolidate subsequent chat messages from the same user into 1 post
    chat_messages[1..-1].each do |chat_message|
      if chat_message.chat_channel_id != chat_channel.id
        # Make sure all chat messages are from the same chat channel
        raise Discourse::InvalidParameters.new("Chat messages must be from the same channel")
      end

      if chat_message.user_id == last_user_id
        post_attributes.last[:raw] += "\n\n#{chat_message.message}"
        post_attributes.last[:chat_message_ids].push(chat_message.id)
      else
        post_attributes.push({
          user: chat_message.user,
          raw: chat_message.message,
          chat_message_ids: [chat_message.id]
        })
      end
      last_user_id = chat_message.user_id
    end

    topic = case params[:type]
            when "newTopic" then create_new_topic_from_messages(Archetype.default, post_attributes)
            when "existingTopic" then add_posts_to_existing_topic(post_attributes)
            when "newMessage" then create_new_topic_from_messages(Archetype.private_message, post_attributes)
      else raise Discourse::InvalidParameters.new("Invalid type")
    end
    render json: { url: topic.url, id: topic.id }
  end

  private

  def create_new_topic_from_messages(archetype, post_attributes)
    post_creator_args = {
      title: params[:title],
      archetype: archetype,
      skip_validations: true,
      raw: post_attributes.first[:raw],
      tags: params[:tags],
    }

    if archetype == Archetype.default
      post_creator_args[:category] = params[:category_id]
    elsif archetype == Archetype.private_message
      usernames = post_attributes.map { |attrs| attrs[:user].username }
      usernames.push(current_user.username)
      post_creator_args[:target_usernames] = usernames.uniq
    end

    first_post = PostCreator.create(post_attributes.first[:user], post_creator_args)
    create_post_connections(post_attributes.first[:chat_message_ids], first_post.id)
    topic = first_post.topic
    post_attributes[1..-1].each { |attrs| create_post(attrs, topic.id) }
    topic
  end

  def create_post(attrs, topic_id)
    post = PostCreator.create(attrs[:user], raw: attrs[:raw], topic_id: topic_id, skip_validations: true)
    create_post_connections(attrs[:chat_message_ids], post.id)
  end

  def create_post_connections(chat_message_ids, post_id)
    chat_message_ids.each do |chat_message_id|
      ChatMessagePostConnection.create(post_id: post_id, chat_message_id: chat_message_id)
    end
  end

  def add_posts_to_existing_topic(post_attributes)
    topic = Topic.find_by(id: params[:topic_id])
    raise Discourse::InvalidParameters.new(:topic_id) unless topic

    # Loop through users and make sure they can all post
    post_attributes.map { |attrs| attrs[:user] }.uniq.each do |user|
      Guardian.new(user).ensure_can_create_post_on_topic!(topic)
    end
    post_attributes.each { |attrs| create_post(attrs, topic.id) }
    topic
  end

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
end
