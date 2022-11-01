# frozen_string_literal: true

class ChatMessageRevision < ActiveRecord::Base
  belongs_to :chat_message
  belongs_to :user
end

# == Schema Information
#
# Table name: chat_message_revisions
#
#  id              :bigint           not null, primary key
#  chat_message_id :integer
#  old_message     :text             not null
#  new_message     :text             not null
#  created_at      :datetime         not null
#  updated_at      :datetime         not null
#  user_id         :integer
#
# Indexes
#
#  index_chat_message_revisions_on_chat_message_id  (chat_message_id)
#  index_chat_message_revisions_on_user_id          (user_id)
#
