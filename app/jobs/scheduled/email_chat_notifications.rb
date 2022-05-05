# frozen_string_literal: true

module Jobs
  class EmailChatNotifications < ::Jobs::Scheduled
    every 15.minutes

    def execute(args = {})
      return unless SiteSetting.chat_enabled

      DiscourseChat::ChatMailer.send_unread_mentions_summary
    end
  end
end
