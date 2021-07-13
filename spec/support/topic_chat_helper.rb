# frozen_string_literal: true

module TopicChatHelper
  def self.make_messages!(topic, users, count)
    users = [users] unless Array === users
    raise ArgumentError if users.length <= 0

    topic = Fabricate(:topic) unless topic
    post = topic.posts.last
    post = Fabricate(:post, topic: topic) unless post

    count.times do |n|
      TopicChatMessage.new(
        topic: topic,
        post: post,
        user: users[n % users.length],
        message: "Chat message for test #{n}",
      ).save!
    end
  end
end
