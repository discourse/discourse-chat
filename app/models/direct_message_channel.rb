# frozen_string_literal: true

class DirectMessageChannel < ActiveRecord::Base
  has_many :direct_message_users
  has_many :users, through: :direct_message_users

  def user_can_access?(user)
    users.include?(user)
  end

  def self.for_user_ids(user_ids)
    includes(direct_message_users: :user)
      .where("NOT EXISTS (SELECT * FROM users
        WHERE NOT EXISTS (SELECT * FROM direct_message_users
          WHERE direct_message_users.user_id = users.id
          AND direct_message_users.direct_message_channel_id = direct_message_channels.id)
        AND users.id IN (?))", user_ids)&.first
  end
end
