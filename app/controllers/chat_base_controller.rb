# frozen_string_literal: true

class DiscourseChat::ChatBaseController < ::ApplicationController
  before_action :ensure_logged_in
  before_action :ensure_can_chat

  private

  def ensure_can_chat
    raise Discourse::NotFound unless SiteSetting.chat_enabled
    guardian.ensure_can_chat!(current_user)
  end

  def set_channel_and_chatable
    @chat_channel = ChatChannel.includes(:chatable).find_by(id: params[:chat_channel_id])
    raise Discourse::NotFound unless @chat_channel

    @chatable = @chat_channel.chatable
    guardian.ensure_can_see_chat_channel!(@chat_channel)
  end
end
