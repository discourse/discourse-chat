# frozen_string_literal: true

class DiscourseChat::DirectMessagesController < DiscourseChat::ChatBaseController
  # NOTE: For V1 of chat channel archiving and deleting we are not doing
  # anything for DM channels, their behaviour will stay as is.
  def create
    guardian.ensure_can_chat!(current_user)
    users = users_from_usernames(current_user, params)
    chat_channel = DiscourseChat::DirectMessageChannelCreator.create!(users)
    render_serialized(chat_channel, ChatChannelSerializer, root: "chat_channel")
  end

  def show
    guardian.ensure_can_chat!(current_user)
    users = users_from_usernames(current_user, params)
    direct_message_channel = DirectMessageChannel.for_user_ids(users.map(&:id).uniq)
    if direct_message_channel
      chat_channel = ChatChannel.find_by(
        chatable_id: direct_message_channel.id,
        chatable_type: 'DirectMessageChannel'
      )
      render_serialized(chat_channel, ChatChannelSerializer, root: "chat_channel")
    else
      render body: nil, status: 404
    end
  end

  private

  def users_from_usernames(current_user, params)
    params.require(:usernames)

    users = [current_user]
    if current_user.username != params[:usernames]
      users.concat(User.where(username: params[:usernames].split(",")).to_a)
    end
    users
  end
end
