# frozen_string_literal: true

class DiscourseChat::ChatMailer
  def self.send_unread_mentions_summary
    return unless SiteSetting.chat_enabled

    users_with_unprocessed_unread_mentions.find_each do |user|
      # user#memberships_with_unread_messages is a nested array that looks like [[membership_id, unread_message_id]]
      # Find the max unread id per membership.
      membership_and_max_unread_mention_ids = user.memberships_with_unread_messages
        .group_by { |memberships| memberships[0] }
        .transform_values do |membership_and_msg_ids|
          membership_and_msg_ids.max_by { |membership, msg| msg }
        end.values

      Jobs.enqueue(:user_email,
        type: "chat_summary",
        user_id: user.id,
        force_respect_seen_recently: true,
        memberships_to_update_data: membership_and_max_unread_mention_ids
      )
    end
  end

  private

  def self.users_with_unprocessed_unread_mentions
    when_away_frequency = UserOption.chat_email_frequencies[:when_away]
    allowed_group_ids = DiscourseChat.allowed_group_ids

    User
      .select('users.id', 'ARRAY_AGG(ARRAY[uccm.id, c_msg.id]) AS memberships_with_unread_messages')
      .joins(:user_option)
      .where(user_options: { chat_enabled: true, chat_email_frequency: when_away_frequency })
      .where('users.last_seen_at < ?', 15.minutes.ago)
      .joins(:groups)
      .where(groups: { id: allowed_group_ids })
      .joins('INNER JOIN user_chat_channel_memberships uccm ON uccm.user_id = users.id')
      .joins('INNER JOIN chat_channels cc ON cc.id = uccm.chat_channel_id')
      .joins('INNER JOIN chat_messages c_msg ON c_msg.chat_channel_id = uccm.chat_channel_id')
      .joins('LEFT OUTER JOIN chat_mentions c_mentions ON c_mentions.chat_message_id = c_msg.id')
      .where(uccm: { following: true })
      .where('c_msg.deleted_at IS NULL AND c_msg.user_id <> users.id')
      .where(
        <<~SQL
          (c_mentions.user_id = uccm.user_id OR cc.chatable_type = 'DirectMessageChannel') AND
          (uccm.last_read_message_id IS NULL OR c_msg.id > uccm.last_read_message_id) AND
          (uccm.last_unread_mention_when_emailed_id IS NULL OR c_msg.id > uccm.last_unread_mention_when_emailed_id)
        SQL
      )
      .group('users.id, uccm.user_id')
  end
end
