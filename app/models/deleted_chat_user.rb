# frozen_string_literal: true

class DeletedChatUser < User
  def username
    "deleted"
  end

  def avatar_template
    "/plugins/discourse-chat/images/deleted-chat-user-avatar.png"
  end
end
