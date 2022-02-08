# frozen_string_literal: true

class ChatView
  attr_reader :current_user, :chat_channel, :messages, :reviewable_ids, :user_flag_statuses

  def initialize(chat_channel, messages, current_user)
    @chat_channel = chat_channel
    @messages = messages
    @current_user = current_user
  end

  def reviewable_ids
    return @reviewable_ids if defined?(@reviewable_ids)

    @reviewable_ids = @current_user.staff? ? ChatMessage.get_reviewable_ids_for(@messages) : nil
  end

  def user_flag_statuses
    return @user_flag_statuses if defined?(@user_flag_statuses)

    @user_flag_statuses = ChatMessage.user_flag_statuses(@current_user, @messages)
  end
end
