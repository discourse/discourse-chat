# frozen_string_literal: true

class DirectMessageChannel < ActiveRecord::Base
  has_many :direct_message_users
  has_many :users, through: :direct_message_users

  def user_can_access?(user)
    users.include?(user)
  end

  def self.for_user_ids(user_ids)
    joins(:users)
      .group("direct_message_channels.id")
      .having("ARRAY[?] = ARRAY_AGG(users.id ORDER BY users.id)", user_ids.sort)
      &.first
  end
end
