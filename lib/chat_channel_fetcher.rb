# frozen_string_literal: true

module DiscourseChat::ChatChannelFetcher
  def self.structured(guardian)
    channels = secured_channels(guardian)
    category_channels = channels.select(&:category_channel?)
    added_channel_ids = category_channels.map(&:id)

    structured_channels = category_channels.map do |category_channel|
      category_channel.chat_channels = channels.select do |channel|
        add = channel.topic_channel? && channel.chatable.category_id == category_channel.chatable.id
        added_channel_ids << channel.id if add
        add
      end
      category_channel
    end

    remaining_channels = channels.select { |channel| !added_channel_ids.include?(channel.id) }
    structured_channels = structured_channels.concat(remaining_channels)

    if guardian.can_access_site_chat?
      structured_channels.prepend(ChatChannel.site_channel)
    end
    structured_channels
  end

  def self.unstructured(guardian)
    channels = secured_channels(guardian, include_chatables: false)
    channels << ChatChannel.site_channel if guardian.user.staff?
    channels
  end

  def self.secured_channels(guardian, include_chatables: true)
    channels = ChatChannel
    channels.includes(:chatables) if include_chatables
    channels = channels.where(chatable_type: ["Topic", "Category"])
    channels.to_a.select { |channel| can_see_channel?(channel, guardian) }
  end

  def self.can_see_channel?(channel, guardian)
    if channel.topic_channel?
      channel.chatable &&
        !channel.chatable.closed &&
        !channel.chatable.archived &&
        guardian.can_see_topic?(channel.chatable)
    elsif channel.category_channel?
      channel.chatable && guardian.can_see_category?(channel.chatable)
    else
      true
    end
  end
end
