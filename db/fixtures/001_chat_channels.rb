ChatChannel.seed do |chat_channel|
  chat_channel.chatable_id = DiscourseChat::SITE_CHAT_ID
  chat_channel.chatable_type = DiscourseChat::SITE_CHAT_TYPE
end
