# frozen_string_literal: true

CHAT_CHANNEL_EDITABLE_PARAMS = [:name, :description]

class DiscourseChat::Api::ChatChannelsController < DiscourseChat::Api
  def update
    guardian.ensure_can_edit_chat_channel!

    chat_channel = find_chat_channel

    if chat_channel.direct_message_channel?
      raise Discourse::InvalidParameters.new(I18n.t("chat.errors.cant_update_direct_message_channel"))
    end

    editable_params = params.permit(*CHAT_CHANNEL_EDITABLE_PARAMS)
    editable_params.each do |k, v|
      editable_params[k] = nil if editable_params[k].blank?
    end
    chat_channel.update!(editable_params)

    ChatPublisher.publish_chat_channel_edit(chat_channel, current_user)

    render_serialized(chat_channel, ChatChannelSerializer, root: false)
  end

  private

  def find_chat_channel
    chat_channel = ChatChannel.find(params.require(:chat_channel_id))
    guardian.ensure_can_see_chat_channel!(chat_channel)
    chat_channel
  end

  def find_membership
    membership = UserChatChannelMembership
      .includes(:user, :chat_channel)
      .find_by!(user: current_user, chat_channel_id: params.require(:chat_channel_id))
    guardian.ensure_can_see_chat_channel!(membership.chat_channel)
    membership
  end
end
