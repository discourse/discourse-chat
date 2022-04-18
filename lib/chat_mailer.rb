# frozen_string_literal: true
#
class DiscourseChat::ChatMailer
  def self.mail_notifications
    return unless SiteSetting.chat_enabled

    instance = self.new
    instance.mail_notifications
  end

  def mail_notifications
    while users.exists?
      users.limit(100).each do |user|
        Jobs.enqueue(:user_email,
                     type: "chat_summary",
                     user_id: user.id,
                     force_respect_seen_recently: true
                    )
        user.user_option.update(last_emailed_for_chat: Time.now)
      end
    end
  end

  def users
    User
      .includes(chat_message_email_statuses: { chat_message: :chat_channel })
      .joins(:groups, :user_option)
      .where(groups: { id: DiscourseChat.allowed_group_ids })
      .where(user_option: { chat_email_frequency: UserOption.chat_email_frequencies[:when_away] })
      .where("user_option.last_emailed_for_chat < ? OR user_option.last_emailed_for_chat IS NULL", 5.minutes.ago)
      .where(chat_message_email_statuses: { status: ChatMessageEmailStatus::STATUSES[:unprocessed] })
      .distinct
  end
end
