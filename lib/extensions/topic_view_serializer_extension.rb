# frozen_string_literal: true

module DiscourseChat::TopicViewSerializerExtension
  def posts
    if SiteSetting.topic_chat_enabled
      posts = object.posts.includes(chat_message_post_connections: :chat_message)
      object.instance_variable_set(:@posts, posts)
    end
    super
  end
end
