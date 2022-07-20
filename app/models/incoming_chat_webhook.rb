# frozen_string_literal: true

class IncomingChatWebhook < ActiveRecord::Base
  belongs_to :chat_channel
  has_many :chat_webhook_events

  before_create { self.key = SecureRandom.hex(12) }

  def url
    "#{Discourse.base_url}/chat/hooks/#{key}.json"
  end
end

# == Schema Information
#
# Table name: incoming_chat_webhooks
#
#  id              :bigint           not null, primary key
#  name            :string           not null
#  key             :string           not null
#  chat_channel_id :integer          not null
#  username        :string
#  description     :string
#  emoji           :string
#  created_at      :datetime         not null
#  updated_at      :datetime         not null
#
# Indexes
#
#  index_incoming_chat_webhooks_on_key_and_chat_channel_id  (key,chat_channel_id)
#
