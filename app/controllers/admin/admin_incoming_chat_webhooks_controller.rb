# frozen_string_literal: true

class DiscourseChat::AdminIncomingChatWebhooksController < Admin::AdminController
  requires_plugin DiscourseChat::PLUGIN_NAME

  def index
    json = {
      chat_channels: ActiveModel::ArraySerializer.new(
        ChatChannel.public_channels,
        each_serializer: ChatChannelSerializer,
        root: false
      ),
      incoming_chat_webhooks: ActiveModel::ArraySerializer.new(
        IncomingChatWebhook.includes(:chat_channel).all,
        each_serializer: IncomingChatWebhookSerializer,
        root: false
      )
    }.as_json

    render json: json
  end

  def create
    params.require([:name, :chat_channel_id])

    chat_channel = ChatChannel.find_by(id: params[:chat_channel_id])
    if chat_channel.nil? || chat_channel.direct_message_channel?
      raise Discourse::InvalidParameters
    end

    webhook = IncomingChatWebhook.new(name: params[:name], chat_channel: chat_channel)
    webhook.key = SecureRandom.hex(12)
    if webhook.save
      render_serialized(webhook, IncomingChatWebhookSerializer, root: false)
    else
      render_json_error(webhook)
    end
  end

  def update
    params.require([:incoming_chat_webhook_id, :name, :chat_channel_id])

    webhook = IncomingChatWebhook.find_by(id: params[:incoming_chat_webhook_id])
    raise Discourse::InvalidParameters unless webhook

    chat_channel = ChatChannel.find_by(id: params[:chat_channel_id])
    if chat_channel.nil? || chat_channel.direct_message_channel?
      raise Discourse::InvalidParameters
    end

    if webhook.update(
        name: params[:name],
        description: params[:description],
        emoji: params[:emoji],
        username: params[:username],
        chat_channel: chat_channel
      )
      render json: success_json
    else
      render_json_error(webhook)
    end
  end

  def destroy
    params.require(:incoming_chat_webhook_id)

    webhook = IncomingChatWebhook.find_by(id: params[:incoming_chat_webhook_id])
    raise Discourse::InvalidParameters unless webhook

    if webhook.destroy
      render json: success_json
    else
      render_json_error(webhook)
    end
  end
end
