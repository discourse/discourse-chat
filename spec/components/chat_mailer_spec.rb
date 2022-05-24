# frozen_string_literal: true

require 'rails_helper'

describe DiscourseChat::ChatMailer do
  before do
    SiteSetting.chat_enabled = true

    @chatters_group = Fabricate(:group)
    SiteSetting.chat_allowed_groups = @chatters_group.id

    @sender = Fabricate(:user, group_ids: [@chatters_group.id])
    @user_1 = Fabricate(:user, group_ids: [@chatters_group.id], last_seen_at: 15.minutes.ago)

    @chat_channel = Fabricate(:chat_channel)
    @chat_message = Fabricate(:chat_message, user: @sender, chat_channel: @chat_channel)

    Fabricate(:user_chat_channel_membership, user: @sender, chat_channel: @chat_channel)

    @user_membership = Fabricate(
      :user_chat_channel_membership, user: @user_1,
                                     chat_channel: @chat_channel, last_read_message_id: nil
    )

    @private_channel = DiscourseChat::DirectMessageChannelCreator.create!([@sender, @user_1])
  end

  def asert_summary_skipped
    expect(job_enqueued?(job: :user_email, args: { type: "chat_summary", user_id: @user_1.id })).to eq(false)
  end

  def assert_only_queued_once
    expect_job_enqueued(job: :user_email, args: { type: "chat_summary", user_id: @user_1.id })
    expect(Jobs::UserEmail.jobs.size).to eq(1)
  end

  describe 'for chat mentions' do
    before do
      @mention = Fabricate(:chat_mention, user: @user_1, chat_message: @chat_message)
    end

    it 'skips users without chat access' do
      @chatters_group.remove(@user_1)

      subject.send_unread_mentions_summary

      asert_summary_skipped
    end

    it 'skips users with summaries disabled' do
      @user_1.user_option.update(chat_email_frequency: UserOption.chat_email_frequencies[:never])

      subject.send_unread_mentions_summary

      asert_summary_skipped
    end

    it "skips a job if the user haven't read the channel since the last summary" do
      @user_membership.update!(last_unread_mention_when_emailed_id: @chat_message.id)

      subject.send_unread_mentions_summary

      asert_summary_skipped
    end

    it 'skips without chat enabled' do
      @user_1.user_option.update(chat_enabled: false, chat_email_frequency: UserOption.chat_email_frequencies[:when_away])

      subject.send_unread_mentions_summary

      asert_summary_skipped
    end

    it 'queues a job for users that was mentioned and never read the channel before' do
      subject.send_unread_mentions_summary

      assert_only_queued_once
    end

    it 'skips the job when the user was mentioned but already read the message' do
      @user_membership.update!(last_read_message_id: @chat_message.id)

      subject.send_unread_mentions_summary

      asert_summary_skipped
    end

    it 'skips the job when the user is not following the channel anymore' do
      @user_membership.update!(last_read_message_id: @chat_message.id - 1, following: false)

      subject.send_unread_mentions_summary

      asert_summary_skipped
    end

    it 'skips users with unread messages from a different channel' do
      @user_membership.update!(last_read_message_id: @chat_message.id)
      second_channel = Fabricate(:chat_channel)
      Fabricate(:user_chat_channel_membership, user: @user_1, chat_channel: second_channel, last_read_message_id: @chat_message.id - 1)

      subject.send_unread_mentions_summary

      asert_summary_skipped
    end

    it 'only queues the job once for users who are member of multiple groups with chat access' do
      chatters_group_2 = Fabricate(:group, users: [@user_1])
      SiteSetting.chat_allowed_groups = [@chatters_group, chatters_group_2].map(&:id).join('|')

      subject.send_unread_mentions_summary

      assert_only_queued_once
    end

    it 'skips users when the mention was deleted' do
      @chat_message.trash!

      subject.send_unread_mentions_summary

      asert_summary_skipped
    end

    it 'queues the job if the user has unread mentions and alread read all the messages in the previous summary' do
      @user_membership.update!(last_read_message_id: @chat_message.id, last_unread_mention_when_emailed_id: @chat_message.id)
      unread_message = Fabricate(:chat_message, chat_channel: @chat_channel, user: @sender)
      Fabricate(:chat_mention, user: @user_1, chat_message: unread_message)

      subject.send_unread_mentions_summary

      expect_job_enqueued(job: :user_email, args: { type: "chat_summary", user_id: @user_1.id })
      expect(Jobs::UserEmail.jobs.size).to eq(1)
    end

    it 'skips users who were seen recently' do
      @user_1.update!(last_seen_at: 2.minutes.ago)

      subject.send_unread_mentions_summary

      asert_summary_skipped
    end

    it "doesn't mix mentions from other users" do
      @mention.destroy!
      user_2 = Fabricate(:user, groups: [@chatters_group], last_seen_at: 20.minutes.ago)
      user_2_membership = Fabricate(:user_chat_channel_membership, user: user_2, chat_channel: @chat_channel, last_read_message_id: nil)
      new_message = Fabricate(:chat_message, chat_channel: @chat_channel, user: @sender)
      Fabricate(:chat_mention, user: user_2, chat_message: new_message)

      subject.send_unread_mentions_summary

      expect(job_enqueued?(job: :user_email, args: { type: "chat_summary", user_id: @user_1.id })).to eq(false)
      expect_job_enqueued(job: :user_email, args: { type: "chat_summary", user_id: user_2.id })
      expect(Jobs::UserEmail.jobs.size).to eq(1)
    end

    describe 'update the user membership after we send the email' do
      before { Jobs.run_immediately! }

      it "doesn't send the same summary the summary again if the user haven't read any channel messages since the last one" do
        @user_membership.update!(last_read_message_id: @chat_message.id - 1)
        subject.send_unread_mentions_summary

        expect(@user_membership.reload.last_unread_mention_when_emailed_id).to eq(@chat_message.id)

        another_channel_message = Fabricate(:chat_message, chat_channel: @chat_channel, user: @sender)
        Fabricate(:chat_mention, user: @user_1, chat_message: another_channel_message)

        expect { subject.send_unread_mentions_summary }.to change(Jobs::UserEmail.jobs, :size).by(0)
      end

      it 'only updates the last_message_read_when_emailed_id on the channel with unread mentions' do
        another_channel = Fabricate(:chat_channel)
        another_channel_message = Fabricate(:chat_message, chat_channel: another_channel, user: @sender)
        Fabricate(:chat_mention, user: @user_1, chat_message: another_channel_message)
        another_channel_membership = Fabricate(
          :user_chat_channel_membership, user: @user_1, chat_channel: another_channel,
                                         last_read_message_id: another_channel_message.id
        )
        @user_membership.update!(last_read_message_id: @chat_message.id - 1)

        subject.send_unread_mentions_summary

        expect(@user_membership.reload.last_unread_mention_when_emailed_id).to eq(@chat_message.id)
        expect(another_channel_membership.reload.last_unread_mention_when_emailed_id).to be_nil
      end
    end
  end

  describe 'for direct messages' do
    before do
      Fabricate(:chat_message, user: @sender, chat_channel: @private_channel)
    end

    it 'queue a job when the user has unread private mentions' do
      subject.send_unread_mentions_summary

      assert_only_queued_once
    end

    it 'only queues the job once when the user has mentions and private messages' do
      Fabricate(:chat_mention, user: @user_1, chat_message: @chat_message)

      subject.send_unread_mentions_summary

      assert_only_queued_once
    end

    it "Doesn't mix or update mentions from other users when joining tables" do
      user_2 = Fabricate(:user, groups: [@chatters_group], last_seen_at: 20.minutes.ago)
      user_2_membership = Fabricate(:user_chat_channel_membership, user: user_2, chat_channel: @chat_channel, last_read_message_id: @chat_message.id)
      Fabricate(:chat_mention, user: user_2, chat_message: @chat_message)

      subject.send_unread_mentions_summary

      assert_only_queued_once
      expect(user_2_membership.reload.last_unread_mention_when_emailed_id).to be_nil
    end
  end
end
