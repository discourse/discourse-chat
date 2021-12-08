# frozen_string_literal: true

class DiscourseChat::IncomingChatWebhooksController < ApplicationController
  WEBHOOK_MAX_MESSAGE_LENGTH = 1000
  WEBHOOK_MESSAGES_PER_MINUTE_LIMIT = 10

  skip_before_action :verify_authenticity_token, :redirect_to_login_if_required

  before_action :validate_payload

  def create_message
    hijack do
      process_webhook_payload(text: params[:text], key: params[:key])
    end
  end

  ##
  # See https://api.slack.com/reference/messaging/payload for the
  # slack message payload format. For now we only support the
  # text param, which we preprocess lightly to remove the slack-isms
  # in the formatting.
  def create_message_slack_compatable
    text = DiscourseChat::SlackCompatibility.process_text(params[:text])

    hijack do
      process_webhook_payload(text: text, key: params[:key])
    end
  end

  private

  def process_webhook_payload(text:, key:)
    validate_message_length(text)
    webhook = find_and_rate_limit_webhook(key)

    chat_message_creator = DiscourseChat::ChatMessageCreator.create(
      chat_channel: webhook.chat_channel,
      user: Discourse.system_user,
      content: text,
      incoming_chat_webhook: webhook
    )
    if chat_message_creator.failed?
      render_json_error(chat_message_creator.chat_message)
    else
      render json: success_json
    end
  end

  def find_and_rate_limit_webhook(key)
    webhook = IncomingChatWebhook.includes(:chat_channel).find_by(key: key)
    raise Discourse::NotFound unless webhook

    # Rate limit to 10 messages per-minute. We can move to a site setting in the future if needed.
    RateLimiter.new(nil, "incoming_chat_webhook_#{webhook.id}", WEBHOOK_MESSAGES_PER_MINUTE_LIMIT, 1.minute).performed!
    webhook
  end

  def validate_message_length(message)
    raise Discourse::InvalidParameters.new("Body cannot be over 1000 characters") if message.length > WEBHOOK_MAX_MESSAGE_LENGTH
  end

  def validate_payload
    # TODO (martin) Remove this at 2021-12-15
    # Backwards compat. We need to replace the body param in our old integrations.
    if params.key?(:body)
      params[:text] = params[:body]
    end

    params.require([:key, :text])
  end
end
