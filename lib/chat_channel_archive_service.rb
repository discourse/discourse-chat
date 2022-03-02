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
    post_creators = []

    # TODO (martin) Maybe we shoudl add a `failure_message` to the ChatChannelArchive
    # model to store the message to show to the admin in the channel? Would consider
    # failed if this message is present and !complete?

    # FIXME (martin) We cannot do one massive transaction, we should do a transaction
    # for each distinct action and one per post.
    #
    # This `execute` function must be resumable on failure!!
    ChatChannelArchive.transaction do
      ensure_destination_topic_exists!

      Rails.logger.info("Creating posts from message batches for #{chat_channel.name} archive, #{chat_channel_archive.total_messages} messages to archive (#{chat_channel_archive.total_messages / ARCHIVED_MESSAGES_PER_POST} posts).")

      chat_channel.chat_messages.find_in_batches(
        batch_size: ARCHIVED_MESSAGES_PER_POST
      ) do |chat_messages|
        post_creators << create_post(
          ChatTranscriptService.new(
            chat_channel, messages: chat_messages
          ).generate_markdown
        )
        delete_message_batch(chat_messages.map(&:id))
      end

      # FIXME (martin) This will no longer be necessary once we do one
      # transaction per post create
      #
      # we want to enqueue jobs for created posts once all the
      # transactions have been committed, because we skip_jobs at
      # time of creation
      post_creators.each(&:enqueue_jobs)

      Rails.logger.info("Creating posts completed for #{chat_channel.name} archive.")
      chat_channel.archive!(chat_channel_archive.archived_by)
    end
  end

  private

  def create_post(raw)
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

    # TODO: (martin): Handle post creator errors
    pc.create
    pc
  end

  def ensure_destination_topic_exists!
    if !chat_channel_archive.destination_topic.present?
      Rails.logger.info("Creating topic for #{chat_channel.name} archive.")
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

      # TODO: (martin): Handle topic creator errors
      chat_channel_archive.update!(destination_topic: topic_creator.create)

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
    ChatMessage.where(id: message_ids).update_all(
      deleted_at: DateTime.now,
      deleted_by_id: chat_channel_archive.archived_by.id
    )

    chat_channel_archive.update!(
      archived_messages: chat_channel_archive.archived_messages + message_ids.length
    )

    Rails.logger.info("Archived #{chat_channel_archive.archived_messages} messages for #{chat_channel.name} archive.")
  end
end
