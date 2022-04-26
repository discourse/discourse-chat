# frozen_string_literal: true

module DiscourseChat::UserNotificationsExtension
  def chat_summary(user, opts)
    puts '############'
    puts '############'
    puts '############'
    puts @email_statuses.any?
    puts '############'
    puts '############'
    @email_statuses = ChatMessageEmailStatus
      .includes(chat_message: [:chat_channel, :user])
      .where(user: user, status: ChatMessageEmailStatus::STATUSES[:unprocessed])
      .to_a
      .filter { |status| status.chat_message.present? }
    return unless @email_statuses.any?

    build_summary_for(user)
    opts = {
      from_alias: I18n.t('user_notifications.chat_summary.from', site_name: Email.site_title),
      subject: I18n.t('user_notifications.chat_summary.subject', count: @email_statuses.count, email_prefix: @email_prefix, date: short_date(Time.now)),
      add_unsubscribe_link: true,
      unsubscribe_url: "#{Discourse.base_url}/email/unsubscribe/#{@unsubscribe_key}",
    }

    @group_email_statuses = @email_statuses.group_by { |status| status.chat_message.chat_channel }
    @group_email_statuses.each do |chat_channel, statuses|
      @group_email_statuses[chat_channel] = statuses.sort_by(&:created_at)
    end
    @user = user

    build_email(user.email, opts)
    ChatMessageEmailStatus.where(user_id: user.id).update_all(status: ChatMessageEmailStatus::STATUSES[:processed])
  end
end
