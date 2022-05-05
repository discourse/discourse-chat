# frozen_string_literal: true

module DiscourseChat::UserNotificationsExtension
  def chat_summary(user, opts)
    @messages = ChatMessage
      .joins(:user, :chat_channel)
      .where.not(user: user)
      .joins('LEFT OUTER JOIN chat_mentions cm ON cm.chat_message_id = chat_messages.id')
      .joins('INNER JOIN user_chat_channel_memberships uccm ON uccm.chat_channel_id = chat_channels.id')
      .where(uccm: { following: true, user_id: user.id })
      .where(
        <<~SQL
          (cm.user_id = #{user.id} OR chat_channels.chatable_type = 'DirectMessageChannel') AND
          (uccm.last_read_message_id IS NULL OR chat_messages.id > uccm.last_read_message_id)
        SQL
      ).to_a
    return if @messages.empty?

    @display_usernames = SiteSetting.prioritize_username_in_ux || !SiteSetting.enable_names

    build_summary_for(user)
    opts = {
      from_alias: I18n.t('user_notifications.chat_summary.from', site_name: Email.site_title),
      subject: I18n.t('user_notifications.chat_summary.subject', count: @messages.size, email_prefix: @email_prefix, date: short_date(Time.now)),
      add_unsubscribe_link: true,
      unsubscribe_url: "#{Discourse.base_url}/email/unsubscribe/#{@unsubscribe_key}",
    }

    @grouped_mentions = @messages.group_by { |message| message.chat_channel }
    @grouped_mentions.each do |chat_channel, mentions|
      @grouped_mentions[chat_channel] = mentions.sort_by(&:created_at)
    end
    @user = user
    @user_tz = UserOption.user_tzinfo(user.id)

    build_email(user.email, opts)
  end
end
