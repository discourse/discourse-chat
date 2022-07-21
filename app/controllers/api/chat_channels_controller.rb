# frozen_string_literal: true

CHAT_CHANNEL_EDITABLE_PARAMS = %i[name description]
CATEGORY_CHAT_CHANNEL_EDITABLE_PARAMS = %i[auto_join_users]

class DiscourseChat::Api::ChatChannelsController < DiscourseChat::Api
  def index
    options = { status: params[:status] ? ChatChannel.statuses[params[:status]] : nil }.merge(
      params.permit(:filter, :limit, :offset),
    ).symbolize_keys!

    channels =
      DiscourseChat::ChatChannelFetcher.secured_public_channels(
        guardian,
        UserChatChannelMembership.where(user: current_user),
        options,
      )

    render_serialized(channels, ChatChannelSerializer)
  end

  def update
    guardian.ensure_can_edit_chat_channel!

    chat_channel = find_chat_channel

    if chat_channel.direct_message_channel?
      raise Discourse::InvalidParameters.new(
              I18n.t("chat.errors.cant_update_direct_message_channel"),
            )
    end

    params_to_edit = editable_params(params, chat_channel)
    params_to_edit.each { |k, v| params_to_edit[k] = nil if params_to_edit[k].blank? }

    if ActiveRecord::Type::Boolean.new.deserialize(params_to_edit[:auto_join_users])
      auto_join_limiter(chat_channel).performed!
    end

    chat_channel.update!(params_to_edit)

    ChatPublisher.publish_chat_channel_edit(chat_channel, current_user)

    if chat_channel.category_channel? && chat_channel.auto_join_users
      UserChatChannelMembership.enforce_automatic_channel_memberships(chat_channel)
    end

    render_serialized(chat_channel, ChatChannelSerializer, root: false)
  end

  private

  def find_chat_channel
    chat_channel = ChatChannel.find(params.require(:chat_channel_id))
    guardian.ensure_can_see_chat_channel!(chat_channel)
    chat_channel
  end

  def find_membership
    membership =
      UserChatChannelMembership.includes(:user, :chat_channel).find_by!(
        user: current_user,
        chat_channel_id: params.require(:chat_channel_id),
      )
    guardian.ensure_can_see_chat_channel!(membership.chat_channel)
    membership
  end

  def auto_join_limiter(chat_channel)
    RateLimiter.new(
      current_user,
      "auto_join_users_channel_#{chat_channel.id}",
      1,
      3.minutes,
      apply_limit_to_staff: true,
    )
  end

  def editable_params(params, chat_channel)
    permitted_params = CHAT_CHANNEL_EDITABLE_PARAMS

    permitted_params += CATEGORY_CHAT_CHANNEL_EDITABLE_PARAMS if chat_channel.category_channel?

    params.permit(*permitted_params)
  end
end
