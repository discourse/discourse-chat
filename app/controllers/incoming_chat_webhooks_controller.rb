# frozen_string_literal: true

class DiscourseChat::IncomingChatWebhooksController < ApplicationController
  skip_before_action :verify_authenticity_token, :redirect_to_login_if_required

  def create_message
    params.require([:key, :body])

    hijack do
      if params[:body].length > 1000
        raise Discourse::InvalidParameters.new("Body cannot be over 1000 characters")
      end

      webhook = IncomingChatWebhook.includes(:chat_channel).find_by(key: params[:key])
      raise Discourse::NotFound unless webhook

      # Rate limit to 10 messages per-minute. We can move to a site setting in the future if needed.
      RateLimiter.new(nil, "incoming_chat_webhook_#{webhook.id}", 10, 1.minute).performed!

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
end
