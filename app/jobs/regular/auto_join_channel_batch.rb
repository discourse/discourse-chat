# frozen_string_literal: true

module Jobs
  class AutoJoinChannelBatch < ::Jobs::Base
    def execute(args)
      return "starts_at or ends_at missing" if args[:starts_at].blank? || args[:ends_at].blank?
      return "End is higher than start" if args[:ends_at] < args[:starts_at]

      channel = ChatChannel.find_by(
        id: args[:chat_channel_id],
        auto_join_users: true,
        chatable_type: 'Category'
      )

      return if !channel

      query_args = {
        chat_channel_id: channel.id,
        start: args[:starts_at],
        end: args[:ends_at],
        suspended_until: Time.zone.now,
        last_seen_at: 3.months.ago,
        channel_category: channel.chatable_id,
        mode: UserChatChannelMembership.join_modes[:automatic]
      }

      records_created = DB.exec(<<~SQL, query_args)
        INSERT INTO user_chat_channel_memberships (user_id, chat_channel_id, following, created_at, updated_at, join_mode)
        SELECT DISTINCT(users.id), :chat_channel_id, TRUE, NOW(), NOW(), :mode
        FROM users
        INNER JOIN user_options uo ON uo.user_id = users.id
        INNER JOIN group_users gu ON gu.user_id = users.id
        INNER JOIN category_groups cg ON cg.group_id = gu.group_id
        LEFT OUTER JOIN user_chat_channel_memberships uccm ON
          uccm.chat_channel_id = :chat_channel_id AND uccm.user_id = users.id
        WHERE users.id >= :start and users.id <= :end AND
        uo.chat_enabled AND
        (uccm.id IS NULL OR uccm.following IS NOT TRUE) AND
        (suspended_till IS NULL OR suspended_till <= :suspended_until) AND
        (last_seen_at IS NULL OR last_seen_at > :last_seen_at) AND
        cg.category_id = :channel_category
        ON CONFLICT (user_id, chat_channel_id) DO UPDATE SET following = true
      SQL

      DB.exec(<<~SQL, channel_id: channel.id, joined: records_created)
        UPDATE chat_channels
        SET user_count = user_count + :joined
        WHERE id = :channel_id
      SQL
    end
  end
end
