# frozen_string_literal: true

Fabricator(:chat_channel) do
  chatable { Fabricate(:topic) }
end

Fabricator(:chat_message) do
  chat_channel
  user
  message "Beep boop"
  cooked "<p>Beep boop</p>"
  cooked_version ChatMessage::BAKED_VERSION
end

Fabricator(:direct_message_channel) do
  users
end

Fabricator(:incoming_chat_webhook) do
  name { sequence(:name) { |i| "#{i + 1}" } }
  key { sequence(:key) { |i| "#{i + 1}" } }
  chat_channel { Fabricate(:chat_channel, chatable: Fabricate(:topic)) }
end

Fabricator(:user_chat_channel_membership) do
  user
  chat_channel
  following true
end

Fabricator(:user_chat_channel_membership_for_dm, from: :user_chat_channel_membership) do
  user
  chat_channel
  following true
  desktop_notification_level 2
  mobile_notification_level 2
end
