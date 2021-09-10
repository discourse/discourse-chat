# frozen_string_literal: true

class DiscourseChat::ChatBaseController < ::ApplicationController
  before_action :ensure_logged_in
  before_action :ensure_can_chat

  private

  def ensure_can_chat
    raise Discourse::NotFound unless SiteSetting.topic_chat_enabled
    guardian.ensure_can_chat!(current_user)
  end

  def set_channel_and_chatable(with_trashed: false)
    chat_channel_query = ChatChannel
    if with_trashed
      chat_channel_query = chat_channel.with_deleted
    end

    @chat_channel = chat_channel_query.find_by(id: params[:chat_channel_id])
    raise Discourse::NotFound unless @chat_channel

    @chatable = nil
    if @chat_channel.site_channel?
      guardian.ensure_can_access_site_chat!
    else
      @chatable = @chat_channel.chatable
      guardian.ensure_can_see!(@chatable)
    end
  end
end
