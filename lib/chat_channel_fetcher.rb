# frozen_string_literal: true

class DiscourseChat::ChatChannelFetcher

  def self.structured(guardian)
    channels = ChatChannel.includes(:chatable).where(chatable_type: ["Topic", "Category"]).all
    channels = channels.to_a.select do |channel|
      if channel.topic_channel?
        !channel.chatable.closed && !channel.chatable.archived && guardian.can_see_topic?(channel.chatable)
      else
        guardian.can_see_category?(channel.chatable)
      end
    end

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
      structured_channels.prepend(ChatChannel.find_by(chatable_id: DiscourseChat::SITE_CHAT_ID))
    end
    structured_channels
  end

  def self.unstructured(guardian)

  end
end
