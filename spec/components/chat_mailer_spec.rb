# frozen_string_literal: true

require 'rails_helper'

describe DiscourseChat::ChatMailer do
  before do
    SiteSetting.chat_enabled = true

    @chatters_group = Fabricate(:group)
    SiteSetting.chat_allowed_groups = @chatters_group.id

    @sender = Fabricate(:user, group_ids: [@chatters_group.id])
    @user_1 = Fabricate(:user, group_ids: [@chatters_group.id])

    @last_emailed = 15.minutes.ago
    @user_1.user_option.update!(last_emailed_for_chat: @last_emailed)

    @chat_channel = Fabricate(:chat_channel)
    @chat_message = Fabricate(:chat_message, user: @sender, chat_channel: @chat_channel)

    Fabricate(:user_chat_channel_membership, user: @sender, chat_channel: @chat_channel)

    @user_membership = Fabricate(
      :user_chat_channel_membership, user: @user_1,
                                     chat_channel: @chat_channel, last_read_message_id: nil
    )

    @private_channel = DiscourseChat::DirectMessageChannelCreator.create!([@sender, @user_1])
  end

  def asert_summary_skipped(last_emailed_at: @last_emailed)
    expect(job_enqueued?(job: :user_email, args: { type: "chat_summary", user_id: @user_1.id })).to eq(false)
    expect(@user_1.user_option.reload.last_emailed_for_chat).to eq_time(last_emailed_at)
  end

  def assert_only_queued_once
    expect_job_enqueued(job: :user_email, args: { type: "chat_summary", user_id: @user_1.id })
    expect(Jobs::UserEmail.jobs.size).to eq(1)
  end

  describe 'for chat mentions' do
    before do
      Fabricate(:chat_mention, user: @user_1, chat_message: @chat_message)
    end

    it 'skips users without chat access' do
      @chatters_group.remove(@user_1)

      subject.send_unread_mentions_summary

      asert_summary_skipped
    end

    it 'skips suspended users' do
      @user_1.update!(suspended_till: 5.months.from_now)

      subject.send_unread_mentions_summary

      asert_summary_skipped
    end

    it 'skips users with summaries disabled' do
      @user_1.user_option.update(chat_email_frequency: UserOption.chat_email_frequencies[:never])

      subject.send_unread_mentions_summary

      asert_summary_skipped
    end

    it 'skips users emailed recently' do
      updated_last_emails = 1.minutes.ago
      @user_1.user_option.update!(last_emailed_for_chat: updated_last_emails)

      subject.send_unread_mentions_summary

      asert_summary_skipped(last_emailed_at: updated_last_emails)
    end

    it 'queues a job for users we never emailed before' do
      @user_1.user_option.update!(last_emailed_for_chat: nil)

      subject.send_unread_mentions_summary

      assert_only_queued_once
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

    it 'updates the last_emailed_for_chat timestamp' do
      @user_membership.update!(last_read_message_id: @chat_message.id - 1)

      subject.send_unread_mentions_summary

      assert_only_queued_once
      expect(@user_1.user_option.reload.last_emailed_for_chat).to be > @last_emailed
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

    it "Doesn't mix mentions from other users when joining tables" do
      user_2 = Fabricate(:user, groups: [@chatters_group])
      Fabricate(:user_chat_channel_membership, user: user_2, chat_channel: @chat_channel, last_read_message_id: @chat_message.id)
      Fabricate(:chat_mention, user: user_2, chat_message: @chat_message)

      subject.send_unread_mentions_summary

      assert_only_queued_once
    end
  end
end
