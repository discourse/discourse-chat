# encoding: utf-8
# frozen_string_literal: true

require 'rails_helper'
require_relative '../support/chat_helper'
require_relative '../fabricators/chat_channel_fabricator'

describe Jobs::SplitLongChats do
  let(:topic) { Fabricate(:topic) }
  let(:chat_channel) { Fabricate(:chat_channel, chatable: topic) }

  before do
    SiteSetting.topic_chat_max_messages_per_post = 10
    chat_channel.save
  end

  it "correctly ignores messages on old posts" do
    older_post = Fabricate(:post, topic: topic)
    older_post.save!
    ChatHelper.make_messages!(topic, Fabricate(:user), 12)
    newer_post = Fabricate(:post, topic: topic)
    newer_post.save!
    ChatHelper.make_messages!(topic, Fabricate(:user), 2)

    expect {
      Jobs::SplitLongChats.new.execute({})
    }.to change { topic.posts.count }.by(0)
  end

  it "makes a post when there's too many messages on the latest post" do
    newer_post = Fabricate(:post, topic: topic)
    newer_post.save!
    ChatHelper.make_messages!(topic, Fabricate(:user), 12)

    expect {
      Jobs::SplitLongChats.new.execute({})
    }.to change { topic.posts.count }.by(1)

    expect(topic.posts.last.user).to eq(Discourse.system_user)
  end
end
