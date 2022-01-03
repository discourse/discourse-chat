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
