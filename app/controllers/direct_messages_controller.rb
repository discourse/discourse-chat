# frozen_string_literal: true

class DiscourseChat::DirectMessagesController < DiscourseChat::ChatBaseController
  def create
    guardian.ensure_can_chat!(current_user)
    params.require(:usernames)

    users = User
      .where(username: params[:usernames].split(","))
      .to_a
      .concat([current_user])
    user_ids = users.map(&:id).uniq
    raise Discourse::InvalidParameters if user_ids.count < 2

    direct_messages_channel = DirectMessageChannel.for_user_ids(user_ids)
    chat_channel = direct_messages_channel ?
      ChatChannel.find_by(chatable: direct_messages_channel) :
      DiscourseChat::DirectMessageChannelCreator.create(users)

    ChatPublisher.publish_new_direct_message_channel(chat_channel, users)
    render_serialized(chat_channel, ChatChannelSerializer, root: "chat_channel")
  end
end
