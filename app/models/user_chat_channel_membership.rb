# frozen_string_literal: true

class UserChatChannelMembership < ActiveRecord::Base
  belongs_to :user
  belongs_to :chat_channel
  belongs_to :last_read_message, class_name: "ChatMessage", optional: true

  DEFAULT_NOTIFICATION_LEVEL = :mention
  NOTIFICATION_LEVELS = { never: 0, mention: 1, always: 2 }
  VALIDATED_ATTRS = %i[following muted desktop_notification_level mobile_notification_level]
  enum desktop_notification_level: NOTIFICATION_LEVELS, _prefix: :desktop_notifications
  enum mobile_notification_level: NOTIFICATION_LEVELS, _prefix: :mobile_notifications

  enum join_mode: { manual: 0, automatic: 1 }

  validate :changes_for_direct_message_channels

  class << self
    def enforce_automatic_channel_memberships(channel)
      Jobs.enqueue(:auto_manage_channel_memberships, chat_channel_id: channel.id)
    end

    def enforce_automatic_user_membership(channel, user)
      Jobs.enqueue(
        :auto_join_channel_batch,
        chat_channel_id: channel.id,
        starts_at: user.id,
        ends_at: user.id,
      )
    end
  end

  private

  def changes_for_direct_message_channels
    needs_validation =
      VALIDATED_ATTRS.any? { |attr| changed_attribute_names_to_save.include?(attr.to_s) }
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
#  join_mode                           :integer          default("manual"), not null
#
# Indexes
#
#  user_chat_channel_memberships_index   (user_id,chat_channel_id,desktop_notification_level,mobile_notification_level,following)
#  user_chat_channel_unique_memberships  (user_id,chat_channel_id) UNIQUE
#
