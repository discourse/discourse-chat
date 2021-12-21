# frozen_string_literal: true

class DiscourseChat::ChatChannelsController < DiscourseChat::ChatBaseController
  def index
    structured = DiscourseChat::ChatChannelFetcher.structured(guardian)
    render_serialized(structured, ChatChannelIndexSerializer, root: false)
  end

  def all
    channels = DiscourseChat::ChatChannelFetcher.secured_public_channels(
      guardian,
      UserChatChannelMembership.where(user: current_user),
      scope_with_membership: false
    )

    render_serialized(channels, ChatChannelSettingsSerializer)
  end

  def show
    set_channel_and_chatable
    render_serialized(@chat_channel, ChatChannelSerializer)
  end

  def follow
    params.require(:chat_channel_id)

    membership = UserChatChannelMembership.includes(:chat_channel).find_or_create_by(
      user_id: current_user.id,
      chat_channel_id: params[:chat_channel_id]
    )
    membership.following = true
    if (membership.save)
      render_serialized(membership, UserChatChannelMembershipSerializer, root: false)
    else
      render_json_error(membership)
    end
  end

  def unfollow
    params.require(:chat_channel_id)

    membership = UserChatChannelMembership
      .includes(:chat_channel)
      .find_by(
        user_id: current_user.id,
        chat_channel_id: params[:chat_channel_id]
      )
    if (membership && membership.update(following: false))
      render json: success_json
    else
      render_json_error(membership)
    end
  end

  def notification_settings
    params.require([
      :chat_channel_id,
      :muted,
      :desktop_notification_level,
      :mobile_notification_level
    ])

    membership = UserChatChannelMembership.find_by(
      user_id: current_user.id,
      chat_channel_id: params[:chat_channel_id]
    )
    raise Discourse::NotFound unless membership

    if membership.update(
      muted: params[:muted],
      desktop_notification_level: params[:desktop_notification_level],
      mobile_notification_level: params[:mobile_notification_level]
    )
      render json: success_json
    else
      render_json_error(membership)
    end
  end

  def for_tag
    params.require(:tag_name)

    tag = Tag.find_by(name: params[:tag_name])
    raise Discourse::NotFound unless tag

    render_channel_for_chatable(
      ChatChannel.find_by(chatable: tag)
    )
  end

  def for_category
    params.require(:category_id)

    render_channel_for_chatable(
      ChatChannel.find_by(chatable_id: params[:category_id], chatable_type: "Category")
    )
  end

  def create
    params.require([:type, :id, :name])
    raise Discourse::NotFound unless guardian.is_staff?
    raise Discourse::InvalidParameters unless ["topic", "category"].include?(params[:type].downcase)
    raise Discourse::InvalidParameters.new(:name) if params[:name].length > SiteSetting.max_topic_title_length

    creating_topic_channel = params[:type].downcase === "topic"
    chatable_type = creating_topic_channel ? "Topic" : "Category"
    existing_args = {
      chatable_type: chatable_type,
      chatable_id: params[:id]
    }
    existing_args[:name] = params[:name] unless creating_topic_channel
    exists = ChatChannel.exists?(existing_args)

    if exists
      translation_key = creating_topic_channel ? "channel_exists_for_topic" : "channel_exists_for_category"
      raise Discourse::InvalidParameters.new(I18n.t("chat.errors.#{translation_key}"))
    end

    chatable = chatable_type.constantize.find_by(id: params[:id])
    raise Discourse::NotFound unless chatable

    chat_channel = ChatChannel.create!(chatable: chatable, name: params[:name])
    chat_channel.user_chat_channel_memberships.create!(user: current_user, following: true)
    render_serialized(chat_channel, ChatChannelSerializer)
  end

  private

  def render_channel_for_chatable(channel)
    if channel
      guardian.ensure_can_see_chat_channel!(channel)
      render_serialized(channel, ChatChannelSerializer)
    else
      render json: { chat_channel: nil }
    end
  end
end
