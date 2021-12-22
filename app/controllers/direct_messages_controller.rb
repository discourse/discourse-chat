# frozen_string_literal: true

class DiscourseChat::DirectMessagesController < DiscourseChat::ChatBaseController
  def create
    guardian.ensure_can_chat!(current_user)
    params.require(:usernames)

    users = [current_user]
    users.concat(User.where(username: params[:usernames].split(",")).to_a) if current_user.username != params[:usernames]
    user_ids = users.map(&:id).uniq

    direct_messages_channel = DirectMessageChannel.for_user_ids(user_ids)
    if direct_messages_channel
      chat_channel = ChatChannel.find_by(chatable: direct_messages_channel)
    else
      chat_channel = DiscourseChat::DirectMessageChannelCreator.create(users)
      ChatPublisher.publish_new_direct_message_channel(chat_channel, users)
    end

    render_serialized(chat_channel, ChatChannelSerializer, root: "chat_channel")
  end
end
