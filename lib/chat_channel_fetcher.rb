# frozen_string_literal: true

module DiscourseChat::ChatChannelFetcher
  def self.structured(guardian)
    channels = secured_public_channels(guardian)
    category_channels = channels.select(&:category_channel?)
    topic_channels = channels.select(&:topic_channel?)
    added_channel_ids = category_channels.map(&:id)

    public_channels = category_channels.map do |category_channel|
      category_channel.chat_channels = channels.select do |channel|
        add = channel.topic_channel? && channel.chatable.category_id == category_channel.chatable.id
        added_channel_ids << channel.id if add
        add
      end
      category_channel
    end

    remaining_channels = topic_channels.select { |channel| !added_channel_ids.include?(channel.id) }
    public_channels = public_channels.concat(remaining_channels)

    if guardian.can_access_site_chat?
      public_channels.prepend(ChatChannel.site_channel)
    end
    {
      public_channels: public_channels,
      direct_message_channels: secured_direct_message_channels(
        guardian.user.id,
        include_chatables: true
      ),
    }
  end

  def self.unstructured(guardian)
    channels = secured_public_channels(guardian, include_chatables: false)
    channels.push(*secured_direct_message_channels(guardian.user.id, include_chatables: false))
    channels << ChatChannel.site_channel if guardian.user.staff?
    channels
  end

  def self.secured_public_channels(guardian, include_chatables: true)
    channels = ChatChannel
    channels.includes(:chatables) if include_chatables
    channels = channels.where(chatable_type: ["Topic", "Category"])
    channels.to_a.select { |channel| can_see_channel?(channel, guardian) }
  end

  def self.secured_direct_message_channels(user_id, include_chatables: false)
    channels = ChatChannel
    channels = channels.includes(chatable: { direct_message_users: :user }) if include_chatables
    channels
      .where(chatable_type: "DirectMessageChannel")
      .where(chatable_id: DirectMessageChannel
        .joins(:direct_message_users)
        .where(direct_message_users: { user_id: user_id })
        .pluck(:id)
            )
  end

  def self.can_see_channel?(channel, guardian)
    if channel.topic_channel?
      return false unless channel.chatable

      !channel.chatable.closed &&
        !channel.chatable.archived &&
        guardian.can_see_topic?(channel.chatable)
    elsif channel.category_channel?
      return false unless channel.chatable

      guardian.can_see_category?(channel.chatable)
    else
      true
    end
  end
end
