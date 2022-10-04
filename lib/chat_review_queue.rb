# frozen_string_literal: true

# Acceptable options:
#   - message: Used when the flag type is notify_user or notify_moderators and we have to create
#     a separate PM.
#   - is_warning: Staff can send warnings when using the notify_user flag.
#   - take_action: Automatically approves the created reviewable and deletes the chat message.
#   - queue_for_review: Adds a special reason to the reviwable score and creates the reviewable using
#     the force_review option.

class DiscourseChat::ChatReviewQueue
  def flag_message(chat_message, guardian, flag_type_id, opts = {})
    result = { success: false, errors: [] }

    guardian.ensure_can_flag_chat_message!(chat_message)
    guardian.ensure_can_flag_message_as!(chat_message, flag_type_id, opts)

    if opts[:message].present? &&
         ReviewableScore.types.slice(:notify_user, :notify_moderators).values.include?(flag_type_id)
      creator = companion_pm_creator(chat_message, guardian.user, flag_type_id, opts)
      post = creator.create

      if creator.errors.present?
        creator.errors.full_messages.each { |msg| result[:errors] << msg }
        return result
      end
    end

    queued_for_review = !!ActiveRecord::Type::Boolean.new.deserialize(opts[:queue_for_review])

    reviewable =
      ReviewableChatMessage.needs_review!(
        created_by: guardian.user,
        target: chat_message,
        reviewable_by_moderator: true,
        potential_spam: flag_type_id == ReviewableScore.types[:spam],
      )
    reviewable.update(target_created_by: chat_message.user)
    score =
      reviewable.add_score(
        guardian.user,
        flag_type_id,
        meta_topic_id: post&.topic_id,
        take_action: opts[:take_action],
        reason: queued_for_review ? "chat_message_queued_by_staff" : nil,
        force_review: queued_for_review,
      )

    if opts[:take_action]
      reviewable.perform(guardian.user, :agree_and_delete)
      ChatPublisher.publish_delete!(chat_message.chat_channel, chat_message)
    else
      enforce_auto_silence_threshold(reviewable)
      ChatPublisher.publish_flag!(chat_message, guardian.user, reviewable, score)
    end

    result.tap do |r|
      r[:success] = true
      r[:reviewable] = reviewable
    end
  end

  private

  def enforce_auto_silence_threshold(reviewable)
    auto_silence_duration = SiteSetting.chat_auto_silence_from_flags_duration
    return if auto_silence_duration.zero?
    return if reviewable.score <= ReviewableChatMessage.score_to_silence_user

    user = reviewable.target_created_by
    return unless user
    return if user.silenced?

    UserSilencer.silence(
      user,
      Discourse.system_user,
      silenced_till: auto_silence_duration.minutes.from_now,
      reason: I18n.t("chat.errors.auto_silence_from_flags"),
    )
  end

  def companion_pm_creator(chat_message, flagger, flag_type_id, opts)
    notifying_user = flag_type_id == ReviewableScore.types[:notify_user]

    i18n_key = notifying_user ? "notify_user" : "notify_moderators"

    title =
      I18n.t(
        "reviewable_score_types.#{i18n_key}.chat_pm_title",
        channel_name: chat_message.chat_channel.title(flagger),
        locale: SiteSetting.default_locale,
      )

    body =
      I18n.t(
        "reviewable_score_types.#{i18n_key}.chat_pm_body",
        message: opts[:message],
        link: chat_message.full_url,
        locale: SiteSetting.default_locale,
      )

    create_args = {
      archetype: Archetype.private_message,
      title: title.truncate(SiteSetting.max_topic_title_length, separator: /\s/),
      raw: body,
    }

    if notifying_user
      create_args[:subtype] = TopicSubtype.notify_user
      create_args[:target_usernames] = chat_message.user.username

      create_args[:is_warning] = opts[:is_warning] if flagger.staff?
    else
      create_args[:subtype] = TopicSubtype.notify_moderators
      create_args[:target_group_names] = [Group[:moderators].name]
    end

    PostCreator.new(flagger, create_args)
  end
end
