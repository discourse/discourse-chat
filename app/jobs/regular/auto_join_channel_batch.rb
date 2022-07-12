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

      category = channel.chatable
      return if !category

      query_args = {
        chat_channel_id: channel.id,
        start: args[:starts_at],
        end: args[:ends_at],
        suspended_until: Time.zone.now,
        last_seen_at: 3.months.ago,
        channel_category: channel.chatable_id,
        mode: UserChatChannelMembership.join_modes[:automatic]
      }

      records_created = DB.exec(create_memberships_query(category), query_args)

      DB.exec(<<~SQL, channel_id: channel.id, joined: records_created)
        UPDATE chat_channels
        SET user_count = user_count + :joined
        WHERE id = :channel_id
      SQL
    end

    private

    def create_memberships_query(category)
      query = <<~SQL
        INSERT INTO user_chat_channel_memberships (user_id, chat_channel_id, following, created_at, updated_at, join_mode)
        SELECT DISTINCT(users.id), :chat_channel_id, TRUE, NOW(), NOW(), :mode
        FROM users
        INNER JOIN user_options uo ON uo.user_id = users.id
        LEFT OUTER JOIN user_chat_channel_memberships uccm ON
          uccm.chat_channel_id = :chat_channel_id AND uccm.user_id = users.id
      SQL

      if category.read_restricted?
        query += <<~SQL
          INNER JOIN group_users gu ON gu.user_id = users.id
          LEFT OUTER JOIN category_groups cg ON cg.group_id = gu.group_id
        SQL
      end

      query += <<~SQL
        WHERE (users.id >= :start AND users.id <= :end) AND
          users.staged IS FALSE AND users.active AND
          NOT EXISTS(SELECT 1 FROM anonymous_users a WHERE a.user_id = users.id) AND
          (suspended_till IS NULL OR suspended_till <= :suspended_until) AND
          (last_seen_at IS NULL OR last_seen_at > :last_seen_at) AND
          uo.chat_enabled AND
          uccm.id IS NULL
      SQL

      if category.read_restricted?
        query += <<~SQL
          AND cg.category_id = :channel_category
        SQL
      end

      query
    end
  end
end
