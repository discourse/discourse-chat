# frozen_string_literal: true

class DiscourseChat::ChatBaseController < ::ApplicationController
  before_action :ensure_logged_in
  before_action :ensure_can_chat

  private

  def ensure_can_chat
    raise Discourse::NotFound unless SiteSetting.topic_chat_enabled
    guardian.ensure_can_chat!(current_user)
  end

  def set_channel_and_chatable
    @chat_channel = ChatChannel.find_by(id: params[:chat_channel_id])
    raise Discourse::NotFound unless @chat_channel

    @chatable = nil
    if !@chat_channel.site_channel?
      @chatable = @chat_channel.chatable
    end

    guardian.ensure_can_see_chat_channel!(@chat_channel)
  end
end
