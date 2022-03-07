# frozen_string_literal: true

Fabricator(:chat_channel) do
  name { ["Gaming Lounge", "Music Lodge", "Random", "Politics", "Sports Center", "Kino Buffs"].sample }
  chatable { Fabricate(:topic) }
  status { :open }
end

Fabricator(:chat_message) do
  chat_channel
  user
  message "Beep boop"
  cooked { |attrs| ChatMessage.cook(attrs[:message]) }
  cooked_version ChatMessage::BAKED_VERSION
end

Fabricator(:reviewable_chat_message) do
  reviewable_by_moderator true
  type 'ReviewableChatMessage'
  created_by { Fabricate(:user) }
  target_type 'ChatMessage'
  target { Fabricate(:chat_message) }
  reviewable_scores { |p| [
    Fabricate.build(:reviewable_score, reviewable_id: p[:id]),
  ]}
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
