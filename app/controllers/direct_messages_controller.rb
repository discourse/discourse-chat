# frozen_string_literal: true

class DiscourseChat::DirectMessagesController < DiscourseChat::ChatBaseController
  # NOTE: For V1 of chat channel archiving and deleting we are not doing
  # anything for DM channels, their behaviour will stay as is.
  def create
    guardian.ensure_can_chat!(current_user)
    params.require(:usernames)

    users = [current_user]
    users.concat(User.where(username: params[:usernames].split(",")).to_a) if current_user.username != params[:usernames]
    chat_channel = DiscourseChat::DirectMessageChannelCreator.create!(users)
    render_serialized(chat_channel, ChatChannelSerializer, root: "chat_channel")
  end
end
