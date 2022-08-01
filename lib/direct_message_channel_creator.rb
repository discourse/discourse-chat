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

    screener =
      UserCommScreener.new(acting_user: acting_user, target_user_ids: target_users.map(&:id))

    # People blocking the actor.
    screener.preventing_actor_communication.each do |user_id|
      raise NotAllowed.new(
              I18n.t(
                "chat.errors.not_accepting_dms",
                username: target_users.find { |user| user.id == user_id }.username,
              ),
            )
    end

    # The actor cannot start DMs with people if they are not allowing anyone
    # to start DMs with them, that's no fair!
    if screener.actor_disallowing_all_pms?
      raise NotAllowed.new(I18n.t("chat.errors.actor_disallowed_dms"))
    end

    # People the actor is blocking.
    target_users.each do |target_user|
      if screener.actor_disallowing_pms?(target_user.id)
        raise NotAllowed.new(
                I18n.t(
                  "chat.errors.actor_preventing_target_user_from_dm",
                  username: target_user.username,
                ),
              )
      end

      if screener.actor_ignoring?(target_user.id)
        raise NotAllowed.new(
                I18n.t("chat.errors.actor_ignoring_target_user", username: target_user.username),
              )
      end

      if screener.actor_muting?(target_user.id)
        raise NotAllowed.new(
                I18n.t("chat.errors.actor_muting_target_user", username: target_user.username),
              )
      end
    end
  end
end
