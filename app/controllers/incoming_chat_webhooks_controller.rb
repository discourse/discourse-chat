# frozen_string_literal: true

class DiscourseChat::IncomingChatWebhooksController < ::ApplicationController
  skip_before_action :verify_authenticity_token

  def create_message
    params.require([:key, :body])

    webhook = IncomingChatWebhook.includes(:chat_channel).find_by(key: params[:key])
    raise Discourse::InvalidParameters unless webhook

    chat_message_creator = DiscourseChat::ChatMessageCreator.create(
      chat_channel: webhook.chat_channel,
      user: Discourse.system_user,
      content: params[:body],
      incoming_chat_webhook: webhook
    )
    if chat_message_creator.failed?
      render_json_error(chat_message_creator.chat_message)
    else
      render json: success_json
    end
  end
end
