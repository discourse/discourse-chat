# frozen_string_literal: true

require 'rails_helper'

describe DiscourseChat::ChatChannelArchiveService do
  fab!(:channel) { Fabricate(:chat_channel) }
  fab!(:user) { Fabricate(:user, admin: true) }
  fab!(:category) { Fabricate(:category) }
  let(:topic_params) do
    {
      topic_title: "This will be a new topic",
      category_id: category.id
    }
  end
  subject { DiscourseChat::ChatChannelArchiveService }

  describe "#begin_archive_process" do
    before do
      3.times do
        Fabricate(:chat_message, chat_channel: channel)
      end
    end

    it "marks the channel as read_only" do
      subject.begin_archive_process(chat_channel: channel, acting_user: user, topic_params: topic_params)
      expect(channel.reload.status).to eq("read_only")
    end

    it "creates the chat channel archive record to save progress and topic params" do
      subject.begin_archive_process(chat_channel: channel, acting_user: user, topic_params: topic_params)
      channel_archive = ChatChannelArchive.find_by(chat_channel: channel)
      expect(channel_archive.archived_by).to eq(user)
      expect(channel_archive.destination_topic_title).to eq("This will be a new topic")
      expect(channel_archive.destination_category_id).to eq(category.id)
      expect(channel_archive.total_messages).to eq(3)
      expect(channel_archive.archived_messages).to eq(0)
    end

    it "enqueues the archive job" do
      channel_archive = subject.begin_archive_process(chat_channel: channel, acting_user: user, topic_params: topic_params)
      expect(job_enqueued?(job: :chat_channel_archive, args: { chat_channel_archive_id: channel_archive.id })).to eq(true)
    end

    it "does nothing if there is already an archive record for the channel" do
      subject.begin_archive_process(chat_channel: channel, acting_user: user, topic_params: topic_params)
      expect {
        subject.begin_archive_process(chat_channel: channel, acting_user: user, topic_params: topic_params)
      }.not_to change { ChatChannelArchive.count }
    end

    it "does not count already deleted messages toward the archive total" do
      new_message = Fabricate(:chat_message, chat_channel: channel)
      new_message.trash!
      channel_archive = subject.begin_archive_process(chat_channel: channel, acting_user: user, topic_params: topic_params)
      expect(channel_archive.total_messages).to eq(3)
    end
  end

  describe "#execute" do
    def create_messages(num)
      num.times do
        Fabricate(:chat_message, chat_channel: channel)
      end
    end

    context "when archiving to a new topic" do
      let(:topic_params) do
        {
          topic_title: "This will be a new topic",
          category_id: category.id
        }
      end

      before do
        @channel_archive = subject.begin_archive_process(chat_channel: channel, acting_user: user, topic_params: topic_params)
      end

      it "makes a topic, deletes all the messages, creates posts for batches of messages, and changes the channel to archived" do
        Rails.logger = @fake_logger = FakeLogger.new
        create_messages(50)
        stub_const(DiscourseChat::ChatChannelArchiveService, "ARCHIVED_MESSAGES_PER_POST", 5) do
          subject.new(@channel_archive).execute
        end

        @channel_archive.reload
        expect(@channel_archive.destination_topic.title).to eq("This will be a new topic")
        expect(@channel_archive.destination_topic.category).to eq(category)
        expect(@channel_archive.destination_topic.user).to eq(user)

        topic = @channel_archive.destination_topic
        expect(topic.posts.count).to eq(11)
        topic.posts.where.not(post_number: 1).each do |post|
          expect(post.raw).to include("[chat")
        end
        expect(topic.archived).to eq(true)

        expect(@channel_archive.archived_messages).to eq(@channel_archive.total_messages)
        expect(@channel_archive.chat_channel.status).to eq("archived")
        expect(@channel_archive.chat_channel.chat_messages.count).to eq(0)
      end

      it "does not stop the process if the post length is too high (validations disabled)" do
        create_messages(50)
        SiteSetting.max_post_length = 1
        subject.new(@channel_archive).execute
        expect(@channel_archive.reload.complete?).to eq(true)
      end

      it "successfully links uploads from messages to the post" do
        create_messages(3)
        ChatUpload.create(chat_message: ChatMessage.last, upload: Fabricate(:upload))
        subject.new(@channel_archive).execute
        expect(@channel_archive.reload.complete?).to eq(true)
        expect(@channel_archive.destination_topic.posts.last.post_uploads.count).to eq(1)
      end
    end

    context "when archiving to an existing topic" do
      fab!(:topic) { Fabricate(:topic) }
      let(:topic_params) do
        {
          topic_id: topic.id
        }
      end

      before do
        3.times do
          Fabricate(:post, topic: topic)
        end

        @channel_archive = subject.begin_archive_process(chat_channel: channel, acting_user: user, topic_params: topic_params)
      end

      it "deletes all the messages, creates posts for batches of messages, and changes the channel to archived" do
        Rails.logger = @fake_logger = FakeLogger.new
        stub_const(DiscourseChat::ChatChannelArchiveService, "ARCHIVED_MESSAGES_PER_POST", 5) do
          subject.new(@channel_archive).execute
        end

        @channel_archive.reload
        expect(@channel_archive.destination_topic.title).to eq(topic.title)
        expect(@channel_archive.destination_topic.category).to eq(topic.category)
        expect(@channel_archive.destination_topic.user).to eq(topic.user)

        topic = @channel_archive.destination_topic

        # existing posts + 10 archive posts
        expect(topic.posts.count).to eq(13)
        topic.posts.where.not(post_number: [1, 2, 3]).each do |post|
          expect(post.raw).to include("[chat")
        end
        expect(topic.archived).to eq(true)

        expect(@channel_archive.archived_messages).to eq(@channel_archive.total_messages)
        expect(@channel_archive.chat_channel.status).to eq("archived")
        expect(@channel_archive.chat_channel.chat_messages.count).to eq(0)
      end
    end
  end
end
