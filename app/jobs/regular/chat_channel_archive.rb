# frozen_string_literal: true

module Jobs
  class ChatChannelArchive < ::Jobs::Base
    sidekiq_options retry: false

    def execute(args = {})
      channel_archive = ::ChatChannelArchive.find_by(id: args[:chat_channel_archive_id])
      return if channel_archive.blank?
      return if channel_archive.complete?

      DistributedMutex.synchronize(
        "archive_chat_channel_#{channel_archive.chat_channel_id}",
        validity: 20.minutes
      ) do
        DiscourseChat::ChatChannelArchiveService.new(channel_archive).execute
      end
    end
  end
end
