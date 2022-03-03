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
    chat_channel_archive.update(archive_error: nil)

    begin
      ensure_destination_topic_exists!

      Rails.logger.info("Creating posts from message batches for #{chat_channel.name} archive, #{chat_channel_archive.total_messages} messages to archive (#{chat_channel_archive.total_messages / ARCHIVED_MESSAGES_PER_POST} posts).")

      # a batch should be idempotent, either the post is created and the
      # messages are deleted or we roll back the whole thing.
      chat_channel.chat_messages.find_in_batches(
        batch_size: ARCHIVED_MESSAGES_PER_POST
      ) do |chat_messages|
        create_post(
          ChatTranscriptService.new(
            chat_channel, messages: chat_messages
          ).generate_markdown
        ) do
          delete_message_batch(chat_messages.map(&:id))
        end
      end

      complete_archive
    rescue => err
      notify_archiver(:failed, error: err)
      raise err
    end
  end

  private

  def create_post(raw)
    pc = nil
    Post.transaction do
      pc = PostCreator.new(
        chat_channel_archive.archived_by,
        raw: raw,

        # we must skip these because the posts are created in a big transaction,
        # we do them all at the end instead
        skip_jobs: true,

        # we do not want to be sending out notifications etc. from this
        # automatic background process
        import_mode: true,

        # don't want to be stopped by watched word or post length validations
        skip_validations: true,

        topic_id: chat_channel_archive.destination_topic_id
      )

      pc.create

      # so we can also delete chat messages in the same transaction
      yield if block_given?
    end
    pc.enqueue_jobs
  end

  def ensure_destination_topic_exists!
    if !chat_channel_archive.destination_topic.present?
      Rails.logger.info("Creating topic for #{chat_channel.name} archive.")
      Topic.transaction do
        topic_creator = TopicCreator.new(
          chat_channel_archive.archived_by,
          Guardian.new(chat_channel_archive.archived_by),
          {
            title: chat_channel_archive.destination_topic_title,
            category: chat_channel_archive.destination_category_id,
            tags: chat_channel_archive.destination_tags,
            import_mode: true
          }
        )

        chat_channel_archive.update!(destination_topic: topic_creator.create)
      end

      Rails.logger.info("Creating first post for #{chat_channel.name} archive.")
      create_post(
        I18n.t(
          "chat.channel.archive.first_post_raw",
          channel_name: chat_channel.name,
          channel_url: chat_channel.url
        )
      )
    else
      Rails.logger.info("Topic already exists for #{chat_channel.name} archive.")
    end

    chat_channel_archive.destination_topic.update!(archived: true)
  end

  def delete_message_batch(message_ids)
    ChatMessage.transaction do
      ChatMessage.where(id: message_ids).update_all(
        deleted_at: DateTime.now,
        deleted_by_id: chat_channel_archive.archived_by.id
      )

      chat_channel_archive.update!(
        archived_messages: chat_channel_archive.archived_messages + message_ids.length
      )
    end

    Rails.logger.info("Archived #{chat_channel_archive.archived_messages} messages for #{chat_channel.name} archive.")
  end

  def complete_archive
    Rails.logger.info("Creating posts completed for #{chat_channel.name} archive.")
    chat_channel.archive!(chat_channel_archive.archived_by)
    notify_archiver(:success)
  end

  def notify_archiver(result, error: nil)
    base_translation_params = {
      channel_name: chat_channel.name,
      topic_title: chat_channel_archive.destination_topic.title,
      topic_url: chat_channel_archive.destination_topic.url
    }

    if result == :failed
      Discourse.warn_exception(
        error,
        message: "Error when archiving chat channel #{chat_channel.name}.",
        env: {
          chat_channel_id: chat_channel.id,
          chat_channel_name: chat_channel.name
        }
      )
      error_translation_params = base_translation_params.merge(
        channel_url: chat_channel.url,
        messages_archived: chat_channel_archive.archived_messages
      )
      chat_channel_archive.update(archive_error: error.message)
      SystemMessage.create_from_system_user(
        chat_channel_archive.archived_by, :chat_channel_archive_failed, error_translation_params
      )
    else
      SystemMessage.create_from_system_user(
        chat_channel_archive.archived_by, :chat_channel_archive_complete, base_translation_params
      )
    end
  end
end
