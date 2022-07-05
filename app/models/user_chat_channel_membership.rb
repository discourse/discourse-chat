# frozen_string_literal: true

class UserChatChannelMembership < ActiveRecord::Base
  belongs_to :user
  belongs_to :chat_channel
  belongs_to :last_read_message, class_name: "ChatMessage", optional: true

  DEFAULT_NOTIFICATION_LEVEL = :mention
  NOTIFICATION_LEVELS = {
    never: 0,
    mention: 1,
    always: 2
  }
  VALIDATED_ATTRS = [
    :following,
    :muted,
    :desktop_notification_level,
    :mobile_notification_level
  ]
  enum desktop_notification_level: NOTIFICATION_LEVELS, _prefix: :desktop_notifications
  enum mobile_notification_level: NOTIFICATION_LEVELS, _prefix: :mobile_notifications

  validate :changes_for_direct_message_channels

  class << self
    def async_auto_join_for(channel)
      Jobs.enqueue(:auto_manage_channel_memberships, mode: Jobs::AutoManageChannelMemberships::JOIN, chat_channel_id: channel.id)
    end

    def async_auto_remove_from(channel)
      Jobs.enqueue(:auto_manage_channel_memberships, mode: Jobs::AutoManageChannelMemberships::REMOVE, chat_channel_id: channel.id)
    end
  end

  private

  def changes_for_direct_message_channels
    needs_validation = VALIDATED_ATTRS.any? { |attr| changed_attribute_names_to_save.include?(attr.to_s) }
    if needs_validation && chat_channel.direct_message_channel?
      errors.add(:muted) if muted
      errors.add(:desktop_notification_level) if desktop_notification_level.to_sym != :always
      errors.add(:mobile_notification_level) if mobile_notification_level.to_sym != :always
    end
  end
end

# == Schema Information
#
# Table name: user_chat_channel_memberships
#
#  id                                  :bigint           not null, primary key
#  user_id                             :integer          not null
#  chat_channel_id                     :integer          not null
#  last_read_message_id                :integer
#  following                           :boolean          default(FALSE), not null
#  muted                               :boolean          default(FALSE), not null
#  desktop_notification_level          :integer          default("mention"), not null
#  mobile_notification_level           :integer          default("mention"), not null
#  created_at                          :datetime         not null
#  updated_at                          :datetime         not null
#  last_unread_mention_when_emailed_id :integer
#
# Indexes
#
#  user_chat_channel_memberships_index   (user_id,chat_channel_id,desktop_notification_level,mobile_notification_level,following)
#  user_chat_channel_unique_memberships  (user_id,chat_channel_id) UNIQUE
#
