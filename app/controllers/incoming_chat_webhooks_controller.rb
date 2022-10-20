# frozen_string_literal: true

class DiscourseChat::IncomingChatWebhooksController < ApplicationController
  WEBHOOK_MAX_MESSAGE_LENGTH = 2000
  WEBHOOK_MESSAGES_PER_MINUTE_LIMIT = 10

  skip_before_action :verify_authenticity_token, :redirect_to_login_if_required

  before_action :validate_payload

  def create_message
    debug_payload

    process_webhook_payload(text: params[:text], key: params[:key])
  end

  # See https://api.slack.com/reference/messaging/payload for the
  # slack message payload format. For now we only support the
  # text param, which we preprocess lightly to remove the slack-isms
  # in the formatting.
  def create_message_slack_compatible
    debug_payload

    # See note in validate_payload on why this is needed
    attachments =
      if params[:payload].present?
        payload = params[:payload]
        if String === payload
          payload = JSON.parse(payload)
          payload.deep_symbolize_keys!
        end
        payload[:attachments]
      else
        params[:attachments]
      end

    if params[:text].present?
      text = DiscourseChat::SlackCompatibility.process_text(params[:text])
    else
      text = DiscourseChat::SlackCompatibility.process_legacy_attachments(attachments)
    end

    process_webhook_payload(text: text, key: params[:key])
  rescue JSON::ParserError
    raise Discourse::InvalidParameters
  end

  private

  def process_webhook_payload(text:, key:)
    validate_message_length(text)
    webhook = find_and_rate_limit_webhook(key)

    chat_message_creator =
      DiscourseChat::ChatMessageCreator.create(
        chat_channel: webhook.chat_channel,
        user: Discourse.system_user,
        content: text,
        incoming_chat_webhook: webhook,
      )
    if chat_message_creator.failed?
      render_json_error(chat_message_creator.error)
    else
      render json: success_json
    end
  end

  def find_and_rate_limit_webhook(key)
    webhook = IncomingChatWebhook.includes(:chat_channel).find_by(key: key)
    raise Discourse::NotFound unless webhook

    # Rate limit to 10 messages per-minute. We can move to a site setting in the future if needed.
    RateLimiter.new(
      nil,
      "incoming_chat_webhook_#{webhook.id}",
      WEBHOOK_MESSAGES_PER_MINUTE_LIMIT,
      1.minute,
    ).performed!
    webhook
  end

  def validate_message_length(message)
    return if message.length <= WEBHOOK_MAX_MESSAGE_LENGTH
    raise Discourse::InvalidParameters.new(
            "Body cannot be over #{WEBHOOK_MAX_MESSAGE_LENGTH} characters",
          )
  end

  def validate_payload
    params.require([:key])

    # TODO (martin) It is not clear whether the :payload key is actually
    # present in the webhooks sent from OpsGenie, so once it is confirmed
    # in production what we are actually getting then we can remove this.
    if !params[:text] && !params[:payload] && !params[:attachments]
      raise Discourse::InvalidParameters
    end
  end

  def debug_payload
    return if !SiteSetting.chat_debug_webhook_payloads
    Rails.logger.warn(
      "Debugging chat webhook payload: " +
        JSON.dump(
          { payload: params[:payload], attachments: params[:attachments], text: params[:text] },
        ),
    )
  end
end
