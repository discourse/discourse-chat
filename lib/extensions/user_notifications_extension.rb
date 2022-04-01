# frozen_string_literal: true

module DiscourseChat::UserNotificationsExtension
  def chat_summary(user, opts)
    build_summary_for(user)
    opts = {
      from_alias: I18n.t('user_notifications.digest.from', site_name: Email.site_title),
      subject: I18n.t('user_notifications.digest.subject_template', email_prefix: @email_prefix, date: short_date(Time.now)),
      add_unsubscribe_link: true,
      unsubscribe_url: "#{Discourse.base_url}/email/unsubscribe/#{@unsubscribe_key}",
    }

    email_statuses = ChatMessageEmailStatus
      .includes(chat_message: [:chat_channel, :user])
      .where(user: user, status: ChatMessageEmailStatus::STATUSES[:unprocessed])
    return unless email_statuses.any?

    email_statuses.update(status: ChatMessageEmailStatus::STATUSES[:processed])
    @group_email_statuses = email_statuses.group_by { |status| status.chat_message.chat_channel }
    @group_email_statuses.each do |chat_channel, statuses|
      @group_email_statuses[chat_channel] = statuses.sort_by(&:created_at)
    end
    @user = user
    build_email(user.email, opts)
  end
end
