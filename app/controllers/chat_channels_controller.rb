# frozen_string_literal: true

class DiscourseChat::ChatChannelsController < ::ApplicationController
  before_action :ensure_logged_in
  before_action :ensure_chat_enabled

  def follow
    params.require(:chat_channel_id)

    membership = UserChatChannelMembership.find_or_create_by(
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

    UserChatChannelMembership.where(
      user_id: current_user.id,
      chat_channel_id: params[:chat_channel_id]
    ).update_all(following: false)
    render json: success_json
  end

  private

  def ensure_chat_enabled
    raise Discourse::NotFound unless SiteSetting.topic_chat_enabled
  end
end
