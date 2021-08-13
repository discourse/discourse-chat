# frozen_string_literal: true

class DiscourseChat::DirectMessagesController < ::ApplicationController
  before_action :ensure_logged_in
  before_action :ensure_chat_enabled

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
    if direct_messages_channel
      chat_channel = ChatChannel.find_by(chatable: direct_messages_channel)
    else
      direct_messages_channel = DirectMessageChannel.create!
      user_ids.each do |user_id|
        direct_messages_channel.direct_message_users.create!(user_id: user_id)
      end
      chat_channel = ChatChannel.create!(chatable: direct_messages_channel)
      last_read_attrs = user_ids.map { |user_id|
        {
          user_id: user_id,
          chat_channel_id: chat_channel.id,
          chat_message_id: nil
        }
      }
      UserChatChannelLastRead.insert_all(last_read_attrs)
      ChatPublisher.publish_new_direct_message_channel(chat_channel, users)
    end

    render_serialized(chat_channel, ChatChannelSerializer, root: "chat_channel")
  end

  private

  def ensure_chat_enabled
    raise Discourse::NotFound unless SiteSetting.topic_chat_enabled
  end
end
