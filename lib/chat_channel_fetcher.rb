# frozen_string_literal: true

module DiscourseChat::ChatChannelFetcher
  def self.structured(guardian)
    memberships = UserChatChannelMembership.where(user_id: guardian.user.id)
    {
      public_channels: structured_public_channels(guardian, memberships),
      direct_message_channels: secured_direct_message_channels(
        guardian.user.id,
        memberships
      ),
    }
  end

  def self.structured_public_channels(guardian, memberships, scope_with_membership: true)
    channels = secured_public_channels(guardian, memberships, scope_with_membership: scope_with_membership)
    category_channels = channels.select(&:category_channel?)
    topic_channels = channels.select(&:topic_channel?)
    tag_channels = channels.select(&:tag_channel?)
    added_channel_ids = category_channels.map(&:id)

    structured = tag_channels + category_channels.map do |category_channel|
      category_channel.chat_channels = channels.select do |channel|
        add = channel.topic_channel? && channel.chatable.category_id == category_channel.chatable.id
        added_channel_ids << channel.id if add
        add
      end
      category_channel
    end

    remaining_channels = topic_channels.select { |channel| !added_channel_ids.include?(channel.id) }
    structured = structured.concat(remaining_channels)
    structured
  end

  def self.secured_public_channels(guardian, memberships, scope_with_membership: true)
    channels = ChatChannel.includes(:chatable, :chat_messages)

    channels = channels.where(chatable_type: ["Topic", "Category", "Tag"])
    if scope_with_membership
      channels = channels
        .joins(:user_chat_channel_memberships)
        .where(user_chat_channel_memberships: { user_id: guardian.user.id, following: true })
    end

    filter_public_channels(channels, memberships, guardian)
  end

  def self.filter_public_channels(channels, memberships, guardian)
    mention_notifications = Notification.unread.where(
      user_id: guardian.user.id,
      notification_type: Notification.types[:chat_mention],
    )
    mention_notification_data = mention_notifications.map { |m| JSON.parse(m.data) }

    secured = []
    hidden_tag_names = DiscourseTagging.hidden_tag_names(guardian)

    channels.each do |channel|
      next unless guardian.can_see_chat_channel?(channel)
      next if channel.tag_channel? && hidden_tag_names.include?(channel.chatable.name)

      membership = memberships.detect { |m| m.chat_channel_id == channel.id }
      if membership
        channel = decorate_channel_from_membership(
          guardian.user.id,
          channel,
          membership,
          mention_notification_data
        )
      end

      secured.push(channel)
    end
    secured
  end

  def self.decorate_channel_from_membership(user_id, channel, membership, mention_notification_data = nil)
    channel.last_read_message_id = membership.last_read_message_id
    channel.muted = membership.muted
    if (!channel.muted)
      channel.unread_count = channel.chat_messages.count { |message|
        message.user_id != user_id && message.id > (membership.last_read_message_id || 0)
      }
    end
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

  def self.secured_direct_message_channels(user_id, memberships)
    channels = ChatChannel
      .includes(chatable: { direct_message_users: :user })
      .includes(:chat_messages)
      .joins(:user_chat_channel_memberships)
      .where(user_chat_channel_memberships: { user_id: user_id, following: true })
      .where(chatable_type: "DirectMessageChannel")
      .order(updated_at: :desc)
      .limit(10)
      .to_a

    channels.map do |channel|
      decorate_channel_from_membership(
        user_id,
        channel,
        memberships.detect { |m| m.user_id == user_id && m.chat_channel_id == channel.id }
      )
    end
  end
end
