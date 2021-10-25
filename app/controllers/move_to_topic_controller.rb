# frozen_string_literal: true

class DiscourseChat::MoveToTopicController < DiscourseChat::ChatBaseController
  NEW_TOPIC = "newTopic"
  EXISTING_TOPIC = "existingTopic"
  NEW_MESSAGE = "newMessage"
  def create
    raise Discourse::NotFound unless SiteSetting.topic_chat_enabled

    params.require([:type, :chat_message_ids, :chat_channel_id])
    chat_channel = ChatChannel.find_by(id: params[:chat_channel_id])
    if chat_channel.nil? || !guardian.can_see_chat_channel?(chat_channel)
      raise Discourse::InvalidParameters.new(:chat_channel_id)
    end

    chat_messages = chat_channel.chat_messages.includes(:user).where(id: params[:chat_message_ids]).order(:id)
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
            when NEW_TOPIC then create_new_topic_from_messages(Archetype.default, post_attributes)
            when EXISTING_TOPIC then add_posts_to_existing_topic(post_attributes)
            when NEW_MESSAGE then create_new_topic_from_messages(Archetype.private_message, post_attributes)
      else raise Discourse::InvalidParameters.new("Invalid type")
    end
    render json: { url: topic.url, id: topic.id }
  end

  private

  def validate_topic_title!
    return if params[:type] == NEW_MESSAGE

    topic = Topic.new(title: params[:title])
    topic.valid?
    if topic.errors[:title].any?
      raise Discourse::InvalidParameters.new("title #{topic.errors[:title].join(", ")}")
    end
  end

  def create_new_topic_from_messages(archetype, post_attributes)
    # Validate topic title separately since we need `skip_validations: true` for short chat messages
    validate_topic_title!
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
end
