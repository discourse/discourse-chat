# frozen_string_literal: true

require 'rails_helper'

describe DiscourseChat::ChatChannelArchiveService do
  class FakeArchiveError < StandardError; end

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

    def start_archive
      @channel_archive = subject.begin_archive_process(chat_channel: channel, acting_user: user, topic_params: topic_params)
    end

    context "when archiving to a new topic" do
      let(:topic_params) do
        {
          topic_title: "This will be a new topic",
          category_id: category.id,
          tags: ["news", "gossip"]
        }
      end

      it "makes a topic, deletes all the messages, creates posts for batches of messages, and changes the channel to archived" do
        create_messages(50) && start_archive
        stub_const(DiscourseChat::ChatChannelArchiveService, "ARCHIVED_MESSAGES_PER_POST", 5) do
          subject.new(@channel_archive).execute
        end

        @channel_archive.reload
        expect(@channel_archive.destination_topic.title).to eq("This will be a new topic")
        expect(@channel_archive.destination_topic.category).to eq(category)
        expect(@channel_archive.destination_topic.user).to eq(user)
        expect(@channel_archive.destination_topic.tags.map(&:name)).to match_array(["news", "gossip"])

        topic = @channel_archive.destination_topic
        expect(topic.posts.count).to eq(11)
        topic.posts.where.not(post_number: 1).each do |post|
          expect(post.raw).to include("[chat")
          expect(post.raw).to include("noLink=\"true\"")
        end
        expect(topic.archived).to eq(true)

        expect(@channel_archive.archived_messages).to eq(50)
        expect(@channel_archive.chat_channel.status).to eq("archived")
        expect(@channel_archive.chat_channel.chat_messages.count).to eq(0)
      end

      it "does not stop the process if the post length is too high (validations disabled)" do
        create_messages(50) && start_archive
        SiteSetting.max_post_length = 1
        subject.new(@channel_archive).execute
        expect(@channel_archive.reload.complete?).to eq(true)
      end

      it "successfully links uploads from messages to the post" do
        create_messages(3) && start_archive
        ChatUpload.create(chat_message: ChatMessage.last, upload: Fabricate(:upload))
        subject.new(@channel_archive).execute
        expect(@channel_archive.reload.complete?).to eq(true)
        expect(@channel_archive.destination_topic.posts.last.post_uploads.count).to eq(1)
      end

      it "successfully sends a private message to the archiving user" do
        create_messages(3) && start_archive
        subject.new(@channel_archive).execute
        expect(@channel_archive.reload.complete?).to eq(true)
        pm_topic = Topic.private_messages.last
        expect(pm_topic.topic_allowed_users.first.user).to eq(@channel_archive.archived_by)
        expect(pm_topic.title).to eq(I18n.t("system_messages.chat_channel_archive_complete.subject_template"))
      end

      it "unfollows (leaves) the channel for all users" do
        create_messages(3)
        channel.chat_messages.map(&:user).each do |user|
          UserChatChannelMembership.create(chat_channel: channel, user: user, following: true)
        end
        expect(UserChatChannelMembership.where(chat_channel: channel, following: true).count).to eq(3)
        start_archive
        subject.new(@channel_archive).execute
        expect(@channel_archive.reload.complete?).to eq(true)
        expect(UserChatChannelMembership.where(chat_channel: channel, following: true).count).to eq(0)
      end

      describe "chat_archive_destination_topic_status setting" do
        context "when set to archived" do
          before { SiteSetting.chat_archive_destination_topic_status = "archived" }

          it "archives the topic" do
            create_messages(3) && start_archive
            subject.new(@channel_archive).execute
            topic = @channel_archive.destination_topic
            topic.reload
            expect(topic.archived).to eq(true)
          end
        end

        context "when set to open" do
          before { SiteSetting.chat_archive_destination_topic_status = "open" }

          it "leaves the topic open" do
            create_messages(3) && start_archive
            subject.new(@channel_archive).execute
            topic = @channel_archive.destination_topic
            topic.reload
            expect(topic.archived).to eq(false)
            expect(topic.open?).to eq(true)
          end
        end

        context "when set to closed" do
          before { SiteSetting.chat_archive_destination_topic_status = "closed" }

          it "closes the topic" do
            create_messages(3) && start_archive
            subject.new(@channel_archive).execute
            topic = @channel_archive.destination_topic
            topic.reload
            expect(topic.archived).to eq(false)
            expect(topic.closed?).to eq(true)
          end
        end

        context "when archiving to an existing topic" do
          it "does not change the status of the topic" do
            create_messages(3) && start_archive
            @channel_archive.update(
              destination_topic_title: nil,
              destination_topic_id: Fabricate(:topic).id
            )
            subject.new(@channel_archive).execute
            topic = @channel_archive.destination_topic
            topic.reload
            expect(topic.archived).to eq(false)
            expect(topic.closed?).to eq(false)
          end
        end
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
      end

      it "deletes all the messages, creates posts for batches of messages, and changes the channel to archived" do
        create_messages(50) && start_archive
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
        expect(topic.archived).to eq(false)

        expect(@channel_archive.archived_messages).to eq(50)
        expect(@channel_archive.chat_channel.status).to eq("archived")
        expect(@channel_archive.chat_channel.chat_messages.count).to eq(0)
      end

      it "handles errors gracefully, sends a private message to the archiving user, and is idempotent on retry" do
        Rails.logger = @fake_logger = FakeLogger.new
        create_messages(35) && start_archive

        DiscourseChat::ChatChannelArchiveService.any_instance.stubs(:create_post).raises(FakeArchiveError.new("this is a test error"))

        stub_const(DiscourseChat::ChatChannelArchiveService, "ARCHIVED_MESSAGES_PER_POST", 5) do
          expect { subject.new(@channel_archive).execute }.to raise_error(FakeArchiveError)
        end

        expect(@channel_archive.reload.archive_error).to eq("this is a test error")

        pm_topic = Topic.private_messages.last
        expect(pm_topic.topic_allowed_users.first.user).to eq(@channel_archive.archived_by)
        expect(pm_topic.title).to eq(I18n.t("system_messages.chat_channel_archive_failed.subject_template"))

        DiscourseChat::ChatChannelArchiveService.any_instance.unstub(:create_post)
        stub_const(DiscourseChat::ChatChannelArchiveService, "ARCHIVED_MESSAGES_PER_POST", 5) do
          subject.new(@channel_archive).execute
        end

        @channel_archive.reload
        expect(@channel_archive.archive_error).to eq(nil)
        expect(@channel_archive.archived_messages).to eq(35)
        expect(@channel_archive.complete?).to eq(true)
        # existing posts + 7 archive posts
        expect(topic.posts.count).to eq(10)
      end
    end
  end
end
