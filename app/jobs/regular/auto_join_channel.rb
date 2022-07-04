# frozen_string_literal: true

module Jobs
  class AutoJoinChannel < ::Jobs::Base

    def execute(args)
      channel = ChatChannel.find_by(id: args[:chat_channel_id])

      return if channel.nil?
      return if !channel.category_channel?

      processed = 0

      user_ids = User
        .distinct
        .select(:id)
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
        .find_in_batches do |batch|
          break if processed >= SiteSetting.max_chat_auto_joined_users

          starts_at = batch.first.id
          ends_at = batch.last.id

          Jobs.enqueue(
            :auto_join_channel_batch,
            chat_channel_id: channel.id, starts_at: starts_at, ends_at: ends_at
          )

          processed += batch.size
        end
    end
  end
end
