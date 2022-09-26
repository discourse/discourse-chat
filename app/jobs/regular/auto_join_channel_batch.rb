# frozen_string_literal: true

module Jobs
  class AutoJoinChannelBatch < ::Jobs::Base
    def execute(args)
      return "starts_at or ends_at missing" if args[:starts_at].blank? || args[:ends_at].blank?
      start_user_id = args[:starts_at].to_i
      end_user_id = args[:ends_at].to_i

      return "End is higher than start" if end_user_id < start_user_id

      channel =
        ChatChannel.find_by(
          id: args[:chat_channel_id],
          auto_join_users: true,
          chatable_type: "Category",
        )

      return if !channel

      category = channel.chatable
      return if !category

      query_args = {
        chat_channel_id: channel.id,
        start: start_user_id,
        end: end_user_id,
        suspended_until: Time.zone.now,
        last_seen_at: 3.months.ago,
        channel_category: channel.chatable_id,
        mode: UserChatChannelMembership.join_modes[:automatic],
      }

      new_member_ids = DB.query_single(create_memberships_query(category), query_args)

      # Only do this if we are running auto-join for a single user, if we
      # are doing it for many then we should do it after all batches are
      # complete for the channel in Jobs::AutoManageChannelMemberships
      if start_user_id == end_user_id
        DiscourseChat::ChatChannelMembershipManager.recalculate_user_count!(channel.id)
      end

      ChatPublisher.publish_new_channel(channel.reload, User.where(id: new_member_ids))
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

      query += <<~SQL if category.read_restricted?
          INNER JOIN group_users gu ON gu.user_id = users.id
          LEFT OUTER JOIN category_groups cg ON cg.group_id = gu.group_id
        SQL

      query += <<~SQL
        WHERE (users.id >= :start AND users.id <= :end) AND
          users.staged IS FALSE AND users.active AND
          NOT EXISTS(SELECT 1 FROM anonymous_users a WHERE a.user_id = users.id) AND
          (suspended_till IS NULL OR suspended_till <= :suspended_until) AND
          (last_seen_at > :last_seen_at) AND
          uo.chat_enabled AND
          uccm.id IS NULL
      SQL

      query += <<~SQL if category.read_restricted?
          AND cg.category_id = :channel_category
        SQL

      query += "RETURNING user_chat_channel_memberships.user_id"
    end
  end
end
