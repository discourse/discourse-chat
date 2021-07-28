# frozen_string_literal: true
ChatChannel.seed(:chatable_id, :chatable_type) do |chat_channel|
  chat_channel.chatable_id = DiscourseChat::SITE_CHAT_ID
  chat_channel.chatable_type = DiscourseChat::SITE_CHAT_TYPE
end
