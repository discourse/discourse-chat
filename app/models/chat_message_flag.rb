# frozen_string_literal: true

class ChatMessageFlag < ActiveRecord::Base
  belongs_to :user
  belongs_to :chat_message
  belongs_to :post_action_type

  def create_reviewable
    reviewable = ReviewableChatMessage.needs_review!(
      created_by: user,
      target: chat_message,
    )
    reviewable.add_score(
      user,
      ReviewableScore.types[:needs_approval],
      force_review: true
    )
  end
end
