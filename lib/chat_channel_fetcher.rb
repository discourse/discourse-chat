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

  def self.all_secured_channel_ids(guardian)
    allowed_channel_ids_sql = <<~SQL
      -- secured topic chat channels
      #{ChatChannel.select(:id).joins(
          "INNER JOIN topics ON topics.id = chat_channels.chatable_id AND chat_channels.chatable_type = 'Topic'
          LEFT JOIN categories ON categories.id = topics.category_id
          LEFT JOIN topic_allowed_users ON topic_allowed_users.topic_id = topics.id"
        ).where(
          "topics.category_id IS NULL OR topics.category_id IN (:allowed_category_ids)",
          allowed_category_ids: guardian.allowed_category_ids
        ).where(
          "topics.archetype = 'regular' OR (topics.archetype = 'private_message' AND topic_allowed_users.user_id = :user_id)",
          user_id: guardian.user.id
        ).to_sql}

      UNION

      -- secured category chat channels
      #{ChatChannel.select(:id).joins(
          "INNER JOIN categories ON categories.id = chat_channels.chatable_id AND chat_channels.chatable_type = 'Category'"
        ).where("categories.id IN (:allowed_category_ids)", allowed_category_ids: guardian.allowed_category_ids).to_sql}

      UNION

      -- secured direct message chat channels
      #{ChatChannel.select(:id).joins(
        "INNER JOIN direct_message_channels ON direct_message_channels.id = chat_channels.chatable_id
            AND chat_channels.chatable_type = 'DirectMessageChannel'
        INNER JOIN direct_message_users ON direct_message_users.direct_message_channel_id = direct_message_channels.id"
        ).where("direct_message_users.user_id = :user_id", user_id: guardian.user.id).to_sql}
    SQL

    DB.query_single(<<~SQL, user_id: guardian.user.id)
      SELECT chat_channel_id
      FROM user_chat_channel_memberships
      WHERE user_chat_channel_memberships.user_id = :user_id
      AND user_chat_channel_memberships.chat_channel_id IN (
        #{allowed_channel_ids_sql}
      )
    SQL
  end

  def self.secured_public_channels(guardian, memberships, scope_with_membership: true, filter: nil)
    channels = ChatChannel.includes(:chatable, :chat_channel_archive)
      .joins("LEFT JOIN categories ON categories.id = chat_channels.chatable_id AND chat_channels.chatable_type = 'Category'")
      .joins("LEFT JOIN topics ON topics.id = chat_channels.chatable_id AND chat_channels.chatable_type = 'Topic'")
      .where(
        chatable_type: ChatChannel.public_channel_chatable_types,
        status: ChatChannel.statuses[:open]
      )

    if filter
      channels = channels.where(<<~SQL, filter: "%#{filter.downcase}%")
        chat_channels.name ILIKE :filter OR categories.name ILIKE :filter OR topics.title ILIKE :filter
      SQL
    end

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

  def self.filter_public_channels(channels, memberships, guardian)
    mention_notifications = Notification.unread.where(
      user_id: guardian.user.id,
      notification_type: Notification.types[:chat_mention],
    )
    mention_notification_data = mention_notifications.map { |m| JSON.parse(m.data) }

    unread_counts_per_channel = unread_counts(channels, guardian.user.id)

    channels.filter_map do |channel|
      next if !guardian.can_see_chat_channel?(channel)

      membership = memberships.find { |m| m.chat_channel_id == channel.id }
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

    channels.filter_map do |channel|
      next if !guardian.can_see_chat_channel?(channel)

      channel = decorate_channel_from_membership(
        user_id,
        channel,
        memberships.find { |m| m.user_id == user_id && m.chat_channel_id == channel.id }
      )

      # direct message channels cannot be muted, so we always need the unread count
      channel.unread_count = unread_counts_per_channel[channel.id]

      channel
    end
  end

  def self.unread_counts(channels, user_id)
    unread_counts = DB.query_array(<<~SQL, channel_ids: channels.map(&:id), user_id: user_id).to_h
      SELECT cc.id, COUNT(*) as count
      FROM chat_messages cm
      JOIN chat_channels cc ON cc.id = cm.chat_channel_id
      JOIN user_chat_channel_memberships uccm ON uccm.chat_channel_id = cc.id
      WHERE cc.id IN (:channel_ids)
        AND cm.user_id != :user_id
        AND uccm.user_id = :user_id
        AND cm.id > COALESCE(uccm.last_read_message_id, 0)
        AND cm.deleted_at IS NULL
      GROUP BY cc.id
    SQL
    unread_counts.default = 0
    unread_counts
  end

  def self.find_with_access_check(channel_id, guardian)
    chat_channel = ChatChannel.find_by(id: channel_id)
    raise Discourse::NotFound if chat_channel.blank?
    raise Discourse::InvalidAccess if !guardian.can_see_chat_channel?(chat_channel)
    chat_channel
  end
end
