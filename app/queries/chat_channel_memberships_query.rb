# frozen_string_literal: true

class ChatChannelMembershipsQuery
  def self.call(channel, limit: 50, offset: 0, username: nil)
    query = UserChatChannelMembership
      .includes(:user)
      .where(chat_channel: channel, following: true)

    if username.present?
      if SiteSetting.prioritize_username_in_ux
        query = query
          .where('users.username_lower ILIKE ?', "%#{username}%")
      else
        query = query
          .where('LOWER(users.name) ILIKE ? OR users.username_lower ILIKE ?', "%#{username}%", "%#{username}%")
      end
    end

    if SiteSetting.enable_names
      query = query.order('users.username_lower DESC')
    else
      query = query.order('users.name DESC')
    end

    query
      .offset(offset)
      .limit(limit)
  end
end
