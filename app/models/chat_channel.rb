# frozen_string_literal: true

class ChatChannel < ActiveRecord::Base
  include Trashable
  attribute :chat_channels, default: []

  belongs_to :chatable, polymorphic: true
  has_many :chat_messages

  def topic_channel?
    chatable_type == "Topic"
  end

  def category_channel?
    chatable_type == "Category"
  end

  def site_channel?
    chatable_type == DiscourseChat::SITE_CHAT_TYPE
  end

  def self.is_enabled?(t)
    return false if !SiteSetting.topic_chat_enabled
    ChatChannel.where(chatable: topic).exists?
  end

  def self.last_regular_post(t)
    # Chat can't be viewed on a small action.
    t.posts.where(post_type: Post.types[:regular]).last
  end

  def last_regular_post
    ChatChannel.last_regular_post(self.chatable)
  end

  def make_separator_post!
    last_post = last_regular_post
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
      topic_id: self.chatable_id,
      skip_validations: true,
    })
    creator.create
  end
end
