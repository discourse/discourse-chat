# frozen_string_literal: true

class DiscourseChat::AdminChatController < ::ApplicationController
  def index
    json = {
      chat_channels: ActiveModel::ArraySerializer.new(
        ChatChannel.public_channels,
        each_serializer: ChatChannelSerializer,
        root: false
      ),
      incoming_chat_webhooks: ActiveModel::ArraySerializer.new(
        IncomingChatWebhook.all,
        each_serializer: IncomingChatWebhookSerializer,
        root: false
      )
    }.as_json

    render json: json
  end
end
