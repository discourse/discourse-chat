# frozen_string_literal: true

class DiscourseChat::ChatChannelArchiveService
  ARCHIVED_MESSAGES_PER_POST = 100

  def self.begin_archive_process(chat_channel:, acting_user:, topic_params:)
    return if ChatChannelArchive.exists?(chat_channel: chat_channel)

    ChatChannelArchive.transaction do
      chat_channel.read_only!(acting_user)

      archive = ChatChannelArchive.create!(
        chat_channel: chat_channel,
        archived_by: acting_user,
        total_messages: chat_channel.chat_messages.count,
        destination_topic_id: topic_params[:topic_id],
        destination_topic_title: topic_params[:topic_title],
        destination_category_id: topic_params[:category_id],
        destination_tags: topic_params[:tags],
      )
      Jobs.enqueue(:chat_channel_archive, chat_channel_archive_id: archive.id)

      archive
    end
  end

  attr_reader :chat_channel_archive, :chat_channel

  def initialize(chat_channel_archive)
    @chat_channel_archive = chat_channel_archive
    @chat_channel = chat_channel_archive.chat_channel
  end

  def execute
    ChatChannelArchive.transaction do
      Rails.logger.info("Creating topic for #{chat_channel.name} archive.")
      ensure_destination_topic_exists!

      Rails.logger.info("Creating first post for #{chat_channel.name} archive.")
      create_post(I18n.t("chat.channel.archive.first_post_raw", channel_name: chat_channel.name, channel_url: chat_channel.url))

      Rails.logger.info("Creating posts from message batches for #{chat_channel.name} archive.")
      Rails.logger.info("#{chat_channel_archive.total_messages} messages to archive (#{chat_channel_archive.total_messages / ARCHIVED_MESSAGES_PER_POST} posts) for #{chat_channel.name} archive.")

      chat_channel.chat_messages.find_in_batches(
        batch_size: ARCHIVED_MESSAGES_PER_POST
      ) do |chat_messages|
        quote_markdown_for_batch = ChatTranscriptService.new(chat_channel, messages: chat_messages).generate_markdown
        create_post(quote_markdown_for_batch)
        ChatMessage.where(id: chat_messages.map(&:id)).update_all(
          deleted_at: DateTime.now, deleted_by_id: chat_channel_archive.archived_by.id
        )
        chat_channel_archive.update(archived_messages: chat_channel_archive.archived_messages + chat_messages.length)
        Rails.logger.info("Archived #{chat_channel_archive.archived_messages} messages for #{chat_channel.name} archive.")
      end

      Rails.logger.info("Creating posts completed for #{chat_channel.name} archive.")
      chat_channel.archive!(chat_channel_archive.archived_by)
    end
  end

  private

  def create_post(raw)
    pc = PostCreator.new(
      chat_channel_archive.archived_by,
      raw: raw,
      skip_jobs: true,
      import_mode: true,
      topic_id: chat_channel_archive.destination_topic_id
    )
    pc.create
    pc.enqueue_jobs
  end

  def ensure_destination_topic_exists!
    if !chat_channel_archive.destination_topic.present?
      topic_creator = TopicCreator.new(
        chat_channel_archive.archived_by,
        Guardian.new(chat_channel_archive.archived_by),
        {
          title: chat_channel_archive.destination_topic_title,
          category: chat_channel_archive.destination_category_id,
          tags: chat_channel_archive.destination_tags,
          visible: false,

          # we do not want to be sending out notifications etc. from this
          # automatic background process
          import_mode: true
        }
      )
      chat_channel_archive.update!(destination_topic: topic_creator.create)
    end
  end
end
