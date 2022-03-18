# frozen_string_literal: true

module Jobs
  class ChatChannelDelete < ::Jobs::Base
    def execute(args = {})
      chat_channel = ::ChatChannel.with_deleted.find_by(id: args[:chat_channel_id])

      # this should not really happen, but better to do this than throw an error
      if chat_channel.blank?
        Rails.logger.warn("Chat channel #{args[:chat_channel_id]} could not be found, aborting delete job.")
        return
      end

      DistributedMutex.synchronize(
        "delete_chat_channel_#{chat_channel.id}",
        validity: 1.minute
      ) do
        Rails.logger.debug("Deleting webhooks and events for channel #{chat_channel.id}")
        ChatMessage.transaction do
          webhooks = IncomingChatWebhook.where(chat_channel: chat_channel)
          ChatWebhookEvent.where(incoming_chat_webhook_id: webhooks.select(:id)).delete_all
          webhooks.delete_all
        end

        Rails.logger.debug("Deleting drafts and memberships for channel #{chat_channel.id}")
        ChatDraft.where(chat_channel: chat_channel).delete_all
        UserChatChannelMembership.where(chat_channel: chat_channel).delete_all

        Rails.logger.debug("Deleting chat messages, mentions, revisions, and uploads for channel #{chat_channel.id}")
        ChatMessage.transaction do
          chat_messages = ChatMessage.where(chat_channel: chat_channel)
          message_ids = chat_messages.select(:id)
          ChatMention.where(chat_message_id: message_ids).delete_all
          ChatMessageRevision.where(chat_message_id: message_ids).delete_all
          ChatMessageReaction.where(chat_message_id: message_ids).delete_all

          # if the uploads are not used anywhere else they will be deleted
          # by the CleanUpUploads job in core
          ChatUpload.where(chat_message_id: message_ids).delete_all

          # only the messages and the channel are Trashable, everything else gets
          # permanently destroyed
          chat_messages.update_all(
            deleted_by_id: chat_channel.deleted_by_id, deleted_at: Time.zone.now
          )
        end
      end
    end
  end
end
