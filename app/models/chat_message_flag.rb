# frozen_string_literal: true

class ChatMessageFlag < ActiveRecord::Base
  belongs_to :user
  belongs_to :chat_message
  belongs_to :reviewable

  def self.create_for(chat_message:, user:)
    flag = create!(chat_message: chat_message, user: user)
    flag.create_reviewable
  end

  def create_reviewable
    reviewable = ReviewableChatMessage.needs_review!(
      created_by: user,
      target: chat_message,
    )
    reviewable.update(target_created_by: chat_message.user)
    reviewable.add_score(
      user,
      ReviewableScore.types[:needs_approval],
      force_review: true
    )
    update(reviewable: reviewable)
  end
end
