# frozen_string_literal: true

class ChatView
  attr_reader :current_user, :chat_channel, :messages

  def initialize(chat_channel, messages, current_user)
    @chat_channel = chat_channel
    @messages = messages
    @current_user = current_user
  end

  def reviewable_ids
    return @reviewable_ids if defined?(@reviewable_ids)

    @reviewable_ids = @current_user.staff? ? get_reviewable_ids : nil
  end

  def user_flag_statuses
    return @user_flag_statuses if defined?(@user_flag_statuses)

    @user_flag_statuses = get_user_flag_statuses
  end

  private

  def get_reviewable_ids
    sql = <<~SQL
        SELECT
          target_id,
          MAX(r.id) reviewable_id
        FROM
          reviewables r
        JOIN
          reviewable_scores s ON reviewable_id = r.id
        WHERE
          r.target_id IN (:message_ids) AND
          r.target_type = 'ChatMessage' AND
          s.status = :pending
        GROUP BY
          target_id
    SQL

    ids = {}

    DB.query(
      sql,
      pending: ReviewableScore.statuses[:pending],
      message_ids: @messages.map(&:id)
    ).each do |row|
      ids[row.target_id] = row.reviewable_id
    end

    ids
  end

  def get_user_flag_statuses
    sql = <<~SQL
        SELECT
          target_id,
          s.status
        FROM
          reviewables r
        JOIN
          reviewable_scores s ON reviewable_id = r.id
        WHERE
          s.user_id = :user_id AND
          r.target_id IN (:message_ids) AND
          r.target_type = 'ChatMessage'
    SQL

    statuses = {}

    DB.query(
      sql,
      message_ids: @messages.map(&:id),
      user_id: @current_user.id
    ).each do |row|
      statuses[row.target_id] = row.status
    end

    statuses
  end
end
