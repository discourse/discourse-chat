# frozen_string_literal: true

module Jobs
  class EmailChatNotifications < ::Jobs::Scheduled
    every 1.hour

    def execute(args = {})
      return unless SiteSetting.chat_enabled

      # DiscourseChat::ChatMailer.run(users: [])
    end
  end
end
