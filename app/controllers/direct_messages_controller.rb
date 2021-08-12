# frozen_string_literal: true

class DiscourseChat::DirectMessagesController < ::ApplicationController
  before_action :ensure_logged_in
  before_action :ensure_chat_enabled

  def create
    guardian.ensure_can_chat!(current_user)
    params.require(:usernames)

    user_ids = User
      .where(username: params[:usernames].split(","))
      .to_a
      .concat([current_user])
      .map(&:id)
      .uniq
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
    end
  end

  private

  def ensure_chat_enabled
    raise Discourse::NotFound unless SiteSetting.topic_chat_enabled
  end
end
