# frozen_string_literal: true

module Jobs
  class SplitLongChats < ::Jobs::Scheduled
    every 1.hour

    def execute(args)
      count = SiteSetting.topic_chat_max_messages_per_post
      if count < 0
        return
      end

      sql = <<~SQL
      WITH last_posts as (
        SELECT t.id as topic_id, max(p.id) as post_id
        FROM chat_channels cc
        LEFT JOIN topics t ON cc.chatable_id = t.id AND cc.chatable_type = 'Topic'
        LEFT JOIN posts p ON p.topic_id = t.id
        WHERE p.post_type = 1
          AND cc.deleted_at IS NULL
        GROUP BY t.id
      )
      SELECT last_posts.topic_id as topic_id
      FROM last_posts
      LEFT JOIN chat_channels cc ON cc.chatable_id = last_posts.topic_id AND cc.chatable_type = 'Topic'
      LEFT JOIN chat_messages cm ON cm.chat_channel_id = cc.id AND cm.post_id = last_posts.post_id
      GROUP BY topic_id
      HAVING COUNT(*) > :count
      SQL

      topic_ids = DB.query_single(sql, count: count)
      topic_ids.each do |id|
        begin
          ChatChannel.find_by(chatable_id: id, chatable_type: 'Topic').make_separator_post!
        rescue => ex
          Discourse.handle_job_exception(ex, error_context(args, "ChatChannel long chat split for id #{id}", topic_id: id))
        end
      end
    end
  end
end
