# frozen_string_literal: true

class DiscourseChat::ChatBaseController < ::ApplicationController
  before_action :ensure_logged_in
  before_action :ensure_can_chat

  private

  def ensure_can_chat
    raise Discourse::NotFound unless SiteSetting.chat_enabled
    guardian.ensure_can_chat!(current_user)
  end

  def set_channel_and_chatable_with_access_check(chat_channel_id: nil)
    if chat_channel_id.blank?
      params.require(:chat_channel_id)
    end
    id_or_name = chat_channel_id || params[:chat_channel_id]
    @chat_channel = DiscourseChat::ChatChannelFetcher.find_with_access_check(
      id_or_name, guardian
    )
    @chatable = @chat_channel.chatable
  end
end
