# frozen_string_literal: true

require 'rails_helper'

describe DiscourseChat::ChatMailer do
  include ActiveJob::TestHelper

  fab!(:chatters_group) { Fabricate(:group) }
  fab!(:sender) { Fabricate(:user, group_ids: [chatters_group.id]) }
  fab!(:user_1) { Fabricate(:user, group_ids: [chatters_group.id]) }
  fab!(:user_2) { Fabricate(:user, group_ids: [chatters_group.id]) }
  fab!(:user_3) { Fabricate(:user, group_ids: [chatters_group.id]) }
  fab!(:chat_channel) { Fabricate(:chat_channel, chatable: Fabricate(:direct_message_channel, users: [sender, user_1, user_2, user_3])) }
  fab!(:chat_message) { Fabricate(:chat_message, user: sender, chat_channel: chat_channel) }
  fab!(:user_1_email_status) { Fabricate(:chat_message_email_status, user: user_1, chat_message: chat_message) }
  fab!(:user_2_email_status) { Fabricate(:chat_message_email_status, user: user_2, chat_message: chat_message) }
  fab!(:user_3_email_status) { Fabricate(:chat_message_email_status, user: user_3, chat_message: chat_message) }

  before do
    SiteSetting.chat_enabled = true
    SiteSetting.chat_allowed_groups = chatters_group.id
    [user_1, user_2, user_3].each do |user|
      user.user_option.update(last_emailed_for_chat: nil)
    end
  end

  it "enqueues user_email jobs for correct users, and updates `last_emailed_for_chat` time" do
    now = Time.now
    freeze_time(now)

    DiscourseChat::ChatMailer.mail_notifications
    expect(job_enqueued?(job: :user_email, args: { type: "chat_summary", user_id: user_1.id })).to be true
    expect(job_enqueued?(job: :user_email, args: { type: "chat_summary", user_id: user_2.id })).to be true
    expect(job_enqueued?(job: :user_email, args: { type: "chat_summary", user_id: user_3.id })).to be true

    expect(user_1.user_option.reload.last_emailed_for_chat).to be_within(0.1).of(now)
    expect(user_2.user_option.reload.last_emailed_for_chat).to be_within(0.1).of(now)
    expect(user_3.user_option.reload.last_emailed_for_chat).to be_within(0.1).of(now)

    unfreeze_time
  end

  it "doesn't enqueue a user_email job for users who don't meet all conditions" do
    # user_1 was just emailed for chat so they don't get an email
    user_1.user_option.update(last_emailed_for_chat: Time.now)

    # user_2 has chat_email_frequency set to `never`
    user_2.user_option.update(chat_email_frequency: UserOption.chat_email_frequencies[:never])

    # user_3 has all ChatMessageEmailStatus record marked as `processed`
    ChatMessageEmailStatus.where(user: user_3).update_all(status: ChatMessageEmailStatus::STATUSES[:processed])

    DiscourseChat::ChatMailer.mail_notifications
    expect(job_enqueued?(job: :user_email, args: { type: "chat_summary", user_id: user_1.id })).to be false
    expect(job_enqueued?(job: :user_email, args: { type: "chat_summary", user_id: user_2.id })).to be false
    expect(job_enqueued?(job: :user_email, args: { type: "chat_summary", user_id: user_3.id })).to be false
  end

  it "doesn't email users who can't chat" do
    SiteSetting.chat_allowed_groups = ""
    DiscourseChat::ChatMailer.mail_notifications
    expect(job_enqueued?(job: :user_email, args: { type: "chat_summary", user_id: user_1.id })).to be false
    expect(job_enqueued?(job: :user_email, args: { type: "chat_summary", user_id: user_2.id })).to be false
    expect(job_enqueued?(job: :user_email, args: { type: "chat_summary", user_id: user_3.id })).to be false
  end

  it "send emails when chat is disabled" do
    SiteSetting.chat_enabled = false
    DiscourseChat::ChatMailer.mail_notifications
    expect(job_enqueued?(job: :user_email, args: { type: "chat_summary", user_id: user_1.id })).to be false
    expect(job_enqueued?(job: :user_email, args: { type: "chat_summary", user_id: user_2.id })).to be false
    expect(job_enqueued?(job: :user_email, args: { type: "chat_summary", user_id: user_3.id })).to be false
  end
end
