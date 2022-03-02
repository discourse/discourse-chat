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
    before do
      50.times do
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

        expect(@channel_archive.archived_messages).to eq(@channel_archive.total_messages)
        expect(@channel_archive.chat_channel.status).to eq("archived")
        expect(@channel_archive.chat_channel.chat_messages.count).to eq(0)
      end
    end

    context "when archiving to an existing topic" do
      fab!(:topic) { Fabricate(:topic) }
      let(:topic_params) do
        {
          topic_id: topic.id
        }
      end

      it "deletes all the messages, creates posts for batches of messages, and changes the channel to archived" do

      end
    end
  end
end
