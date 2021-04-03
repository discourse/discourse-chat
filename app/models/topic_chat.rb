# frozen_string_literal: true

class TopicChat < ActiveRecord::Base
  include Trashable

  belongs_to :topic

  def self.is_enabled?(t)
    return false if !SiteSetting.topic_chat_enabled
    TopicChat.where(topic_id: t.id).exists?
  end

  def make_separator_post!
    last_post = self.topic.posts.where(post_type: Post.types[:regular]).last
    now = Time.now.utc
    message_type = :day
    if last_post.user_id == Discourse.system_user.id
      if last_post.created_at.utc.to_date == now.to_date
        message_type = :hour
      end
    end

    date_text = if message_type == :day
                  now.beginning_of_day.strftime('[date=%Y-%m-%d timezone="UTC"]')
                else
                  now.beginning_of_hour.strftime('[date=%Y-%m-%d time=%H:%M:%S timezone="UTC"]')
                end

    raw = I18n.t("chat.separator_post_#{message_type}.content", date: date_text)

    creator = PostCreator.new(Discourse.system_user, {
      raw: raw,
      topic_id: self.topic.id,
      skip_validations: true,
    })
    creator.create
  end
end
