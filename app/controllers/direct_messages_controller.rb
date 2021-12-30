# frozen_string_literal: true

class DiscourseChat::DirectMessagesController < DiscourseChat::ChatBaseController
  def create
    guardian.ensure_can_chat!(current_user)
    params.require(:usernames)

    users = [current_user]
    users.concat(User.where(username: params[:usernames].split(",")).to_a) if current_user.username != params[:usernames]
    DiscourseChat::DirectMessageChannelCreator.create!(users)

    render_serialized(chat_channel, ChatChannelSerializer, root: "chat_channel")
  end
end
