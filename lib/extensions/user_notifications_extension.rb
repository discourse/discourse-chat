# frozen_string_literal: true

module DiscourseChat::UserNotificationsExtension
  def chat_summary(user, opts)
    guardian = Guardian.new(user)
    return unless guardian.can_chat?(user)

    @messages = ChatMessage
      .joins(:user, :chat_channel)
      .where.not(user: user)
      .where('chat_messages.created_at > ?', 1.week.ago)
      .joins('LEFT OUTER JOIN chat_mentions cm ON cm.chat_message_id = chat_messages.id')
      .joins('INNER JOIN user_chat_channel_memberships uccm ON uccm.chat_channel_id = chat_channels.id')
      .where(uccm: { following: true, user_id: user.id })
      .where(
        <<~SQL
          (cm.user_id = #{user.id} OR chat_channels.chatable_type = 'DirectMessageChannel') AND
          (uccm.last_read_message_id IS NULL OR chat_messages.id > uccm.last_read_message_id) AND
          (uccm.last_unread_mention_when_emailed_id IS NULL OR chat_messages.id > uccm.last_unread_mention_when_emailed_id)
        SQL
      ).to_a
    return if @messages.empty?

    @grouped_messages = @messages.group_by { |message| message.chat_channel }
    @grouped_messages = @grouped_messages.select { |channel, _| guardian.can_see_chat_channel?(channel) }
    return if @grouped_messages.empty?

    @grouped_messages.each do |chat_channel, messages|
      @grouped_messages[chat_channel] = messages.sort_by(&:created_at)
    end
    @user = user
    @user_tz = UserOption.user_tzinfo(user.id)
    @display_usernames = SiteSetting.prioritize_username_in_ux || !SiteSetting.enable_names

    build_summary_for(user)
    @preferences_path = "#{Discourse.base_url}/my/preferences/chat"

    # TODO(roman): Remove after the 2.9 release
    add_unsubscribe_link = UnsubscribeKey.respond_to?(:get_unsubscribe_strategy_for)

    if add_unsubscribe_link
      unsubscribe_key = UnsubscribeKey.create_key_for(@user, 'chat_summary')
      @unsubscribe_link = "#{Discourse.base_url}/email/unsubscribe/#{unsubscribe_key}"
      opts[:unsubscribe_url] = @unsubscribe_link
    end

    channels = @grouped_messages.keys

    grouped_channels = channels.partition { |c| !c.direct_message_channel? }
    non_dm_channels = grouped_channels.first
    dm_channels = grouped_channels.last
    first_channel = non_dm_channels.pop || dm_channels.pop

    subject_opts = {
      email_prefix: @email_prefix,
      count: channels.size,
      channel_title: first_channel.title(user),
      others: other_channels_text(user, channels.size, first_channel, non_dm_channels, dm_channels)
    }

    subject_key = first_channel.direct_message_channel? ? 'direct_message' : 'chat_channel'
    opts = {
      from_alias: I18n.t('user_notifications.chat_summary.from', site_name: Email.site_title),
      subject: I18n.t(with_subject_prefix(subject_key), **subject_opts),
      add_unsubscribe_link: add_unsubscribe_link,
    }

    build_email(user.email, opts)
  end

  def with_subject_prefix(key)
    "user_notifications.chat_summary.subject.#{key}"
  end

  def other_channels_text(user, total_count, first_channel, other_non_dm_channels, other_dm_channels)
    return if total_count <= 1
    return I18n.t(with_subject_prefix('others'), count: total_count - 1) if total_count > 2

    second_channel = other_non_dm_channels.pop || other_dm_channels.pop
    second_channel_title = second_channel.title(user)

    return second_channel_title if first_channel.same_type?(second_channel)

    I18n.t(with_subject_prefix('other_direct_message'), channel_title: second_channel_title)
  end
end
