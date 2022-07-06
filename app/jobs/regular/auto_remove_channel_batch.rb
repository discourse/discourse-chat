# frozen_string_literal: true

module Jobs
  class AutoRemoveChannelBatch < ::Jobs::Base
    def execute(args)
      return "starts_at or ends_at missing" if args[:starts_at].blank? || args[:ends_at].blank?
      return "End is higher than start" if args[:ends_at] < args[:starts_at]

      channel = ChatChannel.find_by(id: args[:chat_channel_id])

      return "Channel not found" if channel.nil?
      return "Chatable is not a category" if !channel.category_channel?
      return "Not an auto-join channel" if !channel.auto_join_users?

      query_args = {
        channel_id: channel.id,
        start: args[:starts_at],
        end: args[:ends_at],
        category_id: channel.chatable_id
      }

      records_updated = DB.exec(<<~SQL, query_args)
        WITH memberships AS (
          SELECT uccm.id
          FROM user_chat_channel_memberships uccm
          INNER JOIN group_users gu ON gu.user_id = uccm.user_id
          LEFT OUTER JOIN category_groups cg ON cg.group_id = gu.group_id AND cg.category_id = :category_id
          WHERE chat_channel_id = :channel_id AND
          uccm.user_id >= :start AND uccm.user_id <= :end
          GROUP BY uccm.user_id, uccm.id
          HAVING bool_and(cg.id IS NULL)
        )
        UPDATE user_chat_channel_memberships uccm
        SET following = false, updated_at = NOW()
        FROM memberships
        WHERE uccm.id =  memberships.id
      SQL

      DB.exec(<<~SQL, channel_id: channel.id, removed: records_updated)
        UPDATE chat_channels
        SET user_count = user_count - :removed
        WHERE id = :channel_id
      SQL
    end
  end
end
