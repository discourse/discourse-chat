# frozen_string_literal: true

module DiscourseChat::DirectMessageChannelCreator
  class NotAllowed < StandardError
  end

  def self.create!(acting_user:, target_users:)
    target_users.uniq!
    direct_messages_channel = DirectMessageChannel.for_user_ids(target_users.map(&:id))
    if direct_messages_channel
      chat_channel = ChatChannel.find_by!(chatable: direct_messages_channel)
    else
      ensure_actor_can_communicate!(acting_user, target_users)
      direct_messages_channel = DirectMessageChannel.create!(user_ids: target_users.map(&:id))
      chat_channel = ChatChannel.create!(chatable: direct_messages_channel)
    end

    update_memberships(target_users, chat_channel.id)
    ChatPublisher.publish_new_channel(chat_channel, target_users)

    chat_channel
  end

  private

  # TODO (martin) Do this in a single query instead of using AR in a loop
  def self.update_memberships(target_users, chat_channel_id)
    target_users.each do |user|
      membership =
        UserChatChannelMembership.find_or_initialize_by(
          user_id: user.id,
          chat_channel_id: chat_channel_id,
        )

      if membership.new_record?
        membership.last_read_message_id = nil
        membership.desktop_notification_level =
          UserChatChannelMembership::NOTIFICATION_LEVELS[:always]
        membership.mobile_notification_level =
          UserChatChannelMembership::NOTIFICATION_LEVELS[:always]
        membership.muted = false
      end

      membership.following = true
      membership.save!
    end
  end

  def self.ensure_actor_can_communicate!(acting_user, target_users)
    # We never want to prevent the actor from communicating with themself.
    target_users = target_users.reject { |user| user.id == acting_user.id }

    UserCommScreener
      .new(acting_user: acting_user, target_user_ids: target_users.map(&:id))
      .preventing_actor_communication
      .each do |user_id|
        raise NotAllowed.new(
                I18n.t(
                  "chat.errors.not_accepting_dms",
                  username: target_users.find { |user| user.id == user_id }.username,
                ),
              )
      end

    # TODO (martin) Add methods from here and below to UserCommScreener in core to
    # handle these cases.

    if !acting_user.user_option.allow_private_messages
      raise NotAllowed.new(I18n.t("chat.errors.actor_disallowed_dms"))
    end

    if acting_user.user_option.enable_allowed_pm_users
      allowed_pm_user_ids = AllowedPmUser.where(user: acting_user).pluck(:allowed_pm_user_id)
      (target_users.map(&:id) - allowed_pm_user_ids).each do |user_id|
        raise NotAllowed.new(
                I18n.t(
                  "chat.errors.actor_preventing_target_user_from_dm",
                  username: target_users.find { |user| user.id == user_id }.username,
                ),
              )
      end
    end

    IgnoredUser
      .where(user: acting_user, ignored_user_id: target_users.map(&:id))
      .pluck(:ignored_user_id)
      .each do |user_id|
        raise NotAllowed.new(
                I18n.t(
                  "chat.errors.actor_ignoring_target_user",
                  username: target_users.find { |user| user.id == user_id }.username,
                ),
              )
      end

    MutedUser
      .where(user: acting_user, muted_user_id: target_users.map(&:id))
      .pluck(:muted_user_id)
      .each do |user_id|
        raise NotAllowed.new(
                I18n.t(
                  "chat.errors.actor_muting_target_user",
                  username: target_users.find { |user| user.id == user_id }.username,
                ),
              )
      end
  end
end
