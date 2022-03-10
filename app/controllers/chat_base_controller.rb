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
    id_or_name = params[:chat_channel_id]
    begin
      id_or_name = Integer(id_or_name)
    rescue ArgumentError
    end

    base_channel_relation = ChatChannel.includes(:chatable)
    if current_user.staff?
      base_channel_relation = base_channel_relation.includes(:chat_channel_archive)
    end

    if id_or_name.is_a? Integer
      @chat_channel = base_channel_relation.find_by(id: id_or_name)
    else
      @chat_channel = base_channel_relation.find_by("LOWER(name) = ?", id_or_name.downcase)
    end

    raise Discourse::NotFound unless @chat_channel

    @chatable = @chat_channel.chatable
    guardian.ensure_can_see_chat_channel!(@chat_channel)
  end
end
