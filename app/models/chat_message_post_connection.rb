# frozen_string_literal: true

class ChatMessagePostConnection < ActiveRecord::Base
  belongs_to :chat_message
  belongs_to :post
end

# == Schema Information
#
# Table name: chat_message_post_connections
#
#  id              :bigint           not null, primary key
#  post_id         :integer          not null
#  chat_message_id :integer          not null
#  created_at      :datetime         not null
#  updated_at      :datetime         not null
#
# Indexes
#
#  chat_message_post_connections_index  (post_id,chat_message_id) UNIQUE
#
