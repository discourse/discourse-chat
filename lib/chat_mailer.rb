# frozen_string_literal: true

class DiscourseChat::ChatMailer
  def send_unread_mentions_summary
    return unless SiteSetting.chat_enabled

    users.find_each do |user|
      Jobs.enqueue(:user_email,
        type: "chat_summary",
        user_id: user.id,
        force_respect_seen_recently: true
      )

      user.user_option.update(last_emailed_for_chat: Time.now)
    end
  end

  def users
    User
      .distinct
      .joins(:user_option)
      .where(user_options: { chat_enabled: true, chat_email_frequency: UserOption.chat_email_frequencies[:when_away] })
      .where('user_options.last_emailed_for_chat IS NULL OR user_options.last_emailed_for_chat < ?', 5.minutes.ago)
      .not_suspended
      .real
      .joins(:groups)
      .where(groups: { id: DiscourseChat.allowed_group_ids })
      .joins('INNER JOIN user_chat_channel_memberships uccm ON uccm.user_id = users.id')
      .joins('INNER JOIN chat_channels cc ON cc.id = uccm.chat_channel_id')
      .joins('INNER JOIN chat_messages c_msg ON c_msg.chat_channel_id = uccm.chat_channel_id')
      .joins('LEFT OUTER JOIN chat_mentions c_mentions ON c_mentions.chat_message_id = c_msg.id AND c_mentions.user_id = users.id')
      .where(uccm: { following: true })
      .where('c_msg.deleted_at IS NULL AND c_msg.user_id <> users.id')
      .where(
      <<~SQL
        (c_mentions.id IS NOT NULL OR cc.chatable_type = 'DirectMessageChannel') AND
        (uccm.last_read_message_id IS NULL OR c_msg.id > uccm.last_read_message_id)
      SQL
    )
  end
end
