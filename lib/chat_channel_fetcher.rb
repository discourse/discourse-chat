# frozen_string_literal: true

module DiscourseChat::ChatChannelFetcher
  def self.structured(guardian)
    memberships = UserChatChannelMembership.where(user_id: guardian.user.id)
    {
      public_channels: secured_public_channels(
        guardian,
        memberships
      ),
      direct_message_channels: secured_direct_message_channels(
        guardian.user.id,
        memberships,
        guardian
      ),
    }
  end

  def self.secured_public_channels(guardian, memberships, scope_with_membership: true)
    channels = ChatChannel.includes(:chatable)
    channels = channels.where(chatable_type: ChatChannel.public_channel_chatable_types)
    if scope_with_membership
      channels = channels
        .joins(:user_chat_channel_memberships)
        .where(user_chat_channel_memberships: { user_id: guardian.user.id, following: true })
    end

    channels = filter_public_channels(channels, memberships, guardian).to_a
    preload_custom_fields_for(channels)
    channels
  end

  def self.preload_custom_fields_for(channels)
    preload_fields = Category.instance_variable_get(:@custom_field_types).keys
    Category.preload_custom_fields(channels.select { |c| c.chatable_type == 'Category' }.map(&:chatable), preload_fields)

    preload_fields = Topic.instance_variable_get(:@custom_field_types).keys
    Topic.preload_custom_fields(channels.select { |c| c.chatable_type == 'Topic' }.map(&:chatable), preload_fields)
  end

  def self.public_channels_with_filter(guardian, memberships, filter)
    channels = ChatChannel
      .includes(:chatable)
      .where(
        chatable_type: ChatChannel.public_channel_chatable_types,
        status: ChatChannel.statuses[:open]
      )
      .where("LOWER(name) LIKE ?", "#{filter}%")
    channels = filter_public_channels(channels, memberships, guardian).to_a
    preload_custom_fields_for(channels)
    channels
  end

  def self.filter_public_channels(channels, memberships, guardian)
    mention_notifications = Notification.unread.where(
      user_id: guardian.user.id,
      notification_type: Notification.types[:chat_mention],
    )
    mention_notification_data = mention_notifications.map { |m| JSON.parse(m.data) }

    unread_counts_per_channel = unread_counts(channels, guardian.user.id)

    channels.filter_map do |channel|
      next unless guardian.can_see_chat_channel?(channel)

      membership = memberships.detect { |m| m.chat_channel_id == channel.id }
      if membership
        channel = decorate_channel_from_membership(
          guardian.user.id,
          channel,
          membership,
          mention_notification_data
        )

        if !channel.muted
          channel.unread_count = unread_counts_per_channel[channel.id]
        end
      end

      channel
    end
  end

  def self.decorate_channel_from_membership(user_id, channel, membership, mention_notification_data = nil)
    channel.last_read_message_id = membership.last_read_message_id
    channel.muted = membership.muted
    if mention_notification_data
      channel.unread_mentions = mention_notification_data.count { |data|
        data["chat_channel_id"] == channel.id &&
          data["chat_message_id"] > (membership.last_read_message_id || 0)
      }
    end
    channel.following = membership.following
    channel.desktop_notification_level = membership.desktop_notification_level
    channel.mobile_notification_level = membership.mobile_notification_level
    channel
  end

  def self.secured_direct_message_channels(user_id, memberships, guardian)
    channels = ChatChannel
      .includes(chatable: [{ direct_message_users: :user }, :users ])
      .joins(:user_chat_channel_memberships)
      .where(user_chat_channel_memberships: { user_id: user_id, following: true })
      .where(chatable_type: "DirectMessageChannel")
      .order(last_message_sent_at: :desc)
      .to_a

    preload_fields = User.allowed_user_custom_fields(guardian) + UserField.all.pluck(:id).map { |fid| "#{User::USER_FIELD_PREFIX}#{fid}" }
    User.preload_custom_fields(channels.map { |c| c.chatable.users }.flatten, preload_fields)

    unread_counts_per_channel = unread_counts(channels, user_id)

    channels.map do |channel|
      channel = decorate_channel_from_membership(
        user_id,
        channel,
        memberships.detect { |m| m.user_id == user_id && m.chat_channel_id == channel.id }
      )

      if !channel.muted
        channel.unread_count = unread_counts_per_channel[channel.id]
      end

      channel
    end
  end

  def self.unread_counts(channels, user_id)
    unread_counts = DB.query(<<~SQL, channel_ids: channels.map(&:id), user_id: user_id)
      SELECT cc.id, COUNT(*) as count
      FROM chat_messages cm
      JOIN chat_channels cc ON cc.id = cm.chat_channel_id
      JOIN user_chat_channel_memberships uccm ON uccm.chat_channel_id = cc.id
      WHERE cc.id IN (:channel_ids) AND cm.user_id != :user_id AND uccm.user_id = :user_id AND cm.id > COALESCE(uccm.last_read_message_id, 0)
      GROUP BY cc.id
    SQL

    unread_counts.each.with_object({}) { |row, map| map[row.id] = row.count }
  end
end
