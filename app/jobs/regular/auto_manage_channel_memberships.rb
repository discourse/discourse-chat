# frozen_string_literal: true

module Jobs
  class AutoManageChannelMemberships < ::Jobs::Base
    JOIN = 'join'
    REMOVE = 'remove'

    def execute(args)
      channel = ChatChannel.find_by(id: args[:chat_channel_id])
      mode = args[:mode]

      return if channel.nil?
      return if !channel.category_channel?
      return if !channel.auto_join_users?
      return if ![JOIN, REMOVE].include?(mode)

      processed = 0

      query_for(args[:mode], channel).find_in_batches do |batch|
        break if join_mode?(mode) && processed >= SiteSetting.max_chat_auto_joined_users

        starts_at = batch.first.query_user_id
        ends_at = batch.last.query_user_id

        Jobs.enqueue(
          batch_job_name_for(mode),
          chat_channel_id: channel.id, starts_at: starts_at, ends_at: ends_at
        )

        processed += batch.size
      end
    end

    private

    def join_mode?(mode)
      mode == JOIN
    end

    def query_for(mode, channel)
      join_mode?(mode) ? auto_join_query(channel) : auto_remove_query(channel)
    end

    def batch_job_name_for(mode)
      join_mode?(mode) ? :auto_join_channel_batch : :auto_remove_channel_batch
    end

    def auto_join_query(channel)
      User
        .distinct
        .select(:id, 'users.id AS query_user_id')
        .where('last_seen_at > ?', 3.months.ago)
        .joins(:user_option)
        .where(user_options: { chat_enabled: true })
        .joins(:group_users)
        .joins('INNER JOIN category_groups cg ON cg.group_id = group_users.group_id')
        .where('cg.category_id = ?', channel.chatable_id)
        .joins(
          <<~SQL
            LEFT OUTER JOIN user_chat_channel_memberships uccm
            ON uccm.chat_channel_id = #{channel.id} AND
            uccm.user_id = users.id
          SQL
        )
        .where('uccm.id IS NULL OR uccm.following IS NOT TRUE')
    end

    def auto_remove_query(channel)
      UserChatChannelMembership
        .select(:id, 'user_chat_channel_memberships.user_id AS query_user_id')
        .where(following: true, chat_channel_id: channel.id)
        .joins('INNER JOIN group_users gu ON gu.user_id = user_chat_channel_memberships.user_id')
        .joins("LEFT OUTER JOIN category_groups cg ON cg.group_id = gu.group_id AND cg.category_id = #{channel.chatable_id}")
        .group('user_chat_channel_memberships.user_id', 'user_chat_channel_memberships.id')
        .having('bool_and(cg.id IS NULL)')
    end
  end
end
