# frozen_string_literal: true

module DiscourseChat::DirectMessageChannelCreator
  class NotAllowed < StandardError
  end

  def self.create!(acting_user:, target_users:)
    Guardian.new(acting_user).ensure_can_create_direct_message!
    target_users.uniq!
    direct_messages_channel = DirectMessageChannel.for_user_ids(target_users.map(&:id))
    if direct_messages_channel
      chat_channel = ChatChannel.find_by!(chatable: direct_messages_channel)
    else
      ensure_actor_can_communicate!(acting_user, target_users)
      direct_messages_channel = DirectMessageChannel.create!(user_ids: target_users.map(&:id))
      chat_channel = direct_messages_channel.create_chat_channel!
    end

    update_memberships(acting_user, target_users, chat_channel.id)
    ChatPublisher.publish_new_channel(chat_channel, target_users)

    chat_channel
  end

  private

  def self.update_memberships(acting_user, target_users, chat_channel_id)
    sql_params = {
      acting_user_id: acting_user.id,
      user_ids: target_users.map(&:id),
      chat_channel_id: chat_channel_id,
      always_notification_level: UserChatChannelMembership::NOTIFICATION_LEVELS[:always],
    }

    DB.exec(<<~SQL, sql_params)
      INSERT INTO user_chat_channel_memberships(
        user_id,
        chat_channel_id,
        muted,
        following,
        desktop_notification_level,
        mobile_notification_level,
        created_at,
        updated_at
      )
      VALUES(
        unnest(array[:user_ids]),
        :chat_channel_id,
        false,
        false,
        :always_notification_level,
        :always_notification_level,
        NOW(),
        NOW()
      )
      ON CONFLICT (user_id, chat_channel_id) DO NOTHING;

      UPDATE user_chat_channel_memberships
      SET following = true
      WHERE user_id = :acting_user_id AND chat_channel_id = :chat_channel_id;
    SQL
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
