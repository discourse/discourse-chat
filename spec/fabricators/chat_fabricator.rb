# frozen_string_literal: true

Fabricator(:chat_channel) do
  chatable nil
end

Fabricator(:site_chat_channel, from: :chat_channel) do
  chatable_id DiscourseChat::SITE_CHAT_ID
  chatable_type DiscourseChat::SITE_CHAT_TYPE
end

Fabricator(:chat_message) do
  chat_channel
  user
  message "Beep boop"
end

Fabricator(:direct_message_channel) do
  users
end
