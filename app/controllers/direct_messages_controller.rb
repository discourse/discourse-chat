# frozen_string_literal: true

class DiscourseChat::DirectMessagesController < DiscourseChat::ChatBaseController
  # TODO (martin) Do we allow archiving DM channels, and if so what does that look like?
  def create
    guardian.ensure_can_chat!(current_user)
    params.require(:usernames)

    users = [current_user]
    users.concat(User.where(username: params[:usernames].split(",")).to_a) if current_user.username != params[:usernames]
    chat_channel = DiscourseChat::DirectMessageChannelCreator.create!(users)
    render_serialized(chat_channel, ChatChannelSerializer, root: "chat_channel")
  end
end
