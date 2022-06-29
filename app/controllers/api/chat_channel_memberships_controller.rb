# frozen_string_literal: true

class DiscourseChat::Api::ChatChannelMembershipsController < DiscourseChat::Api::ChatChannelsController
  def index
    channel = find_chat_channel

    offset = (params[:offset] || 0).to_i
    limit = (params[:limit] || 50).to_i.clamp(1, 50)

    memberships = ChatChannelMembershipsQuery.call(
      channel,
      offset: offset,
      limit: limit,
      username: params[:username]
    )

    render_serialized(memberships, UserChatChannelMembershipSerializer, root: false)
  end
end
