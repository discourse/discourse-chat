# frozen_string_literal: true

describe Jobs::EmailChatNotifications do
  before do
    Jobs.run_immediately!
  end

  context 'chat is enabled' do
    before do
      SiteSetting.chat_enabled = true
    end

    it 'starts the mailer' do
      DiscourseChat::ChatMailer.expects(:send_unread_mentions_summary)

      Jobs.enqueue(:email_chat_notifications)
    end
  end

  context 'chat is not enabled' do
    it 'does nothing' do
      DiscourseChat::ChatMailer.expects(:send_unread_mentions_summary).never

      Jobs.enqueue(:email_chat_notifications)
    end
  end
end
