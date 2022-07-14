# frozen_string_literal: true

class DiscourseChat::DirectMessagesController < DiscourseChat::ChatBaseController
  # NOTE: For V1 of chat channel archiving and deleting we are not doing
  # anything for DM channels, their behaviour will stay as is.
  def create
    guardian.ensure_can_chat!(current_user)
    users = users_from_usernames(current_user, params)

    begin
      chat_channel = DiscourseChat::DirectMessageChannelCreator.create!(
        acting_user: current_user, target_users: users
      )
      render_serialized(chat_channel, ChatChannelSerializer, root: "chat_channel")
    rescue DiscourseChat::DirectMessageChannelCreator::NotAllowed => err
      render_json_error(err.message)
    end
  end

  def index
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

    usernames = if params[:usernames].is_a?(String)
      params[:usernames].split(",")
    else
      params[:usernames]
    end

    users = [current_user]
    other_usernames = usernames - [current_user.username]
    if other_usernames.any?
      users.concat(User.where(username: other_usernames).to_a)
    end
    users
  end
end
