# frozen_string_literal: true

module DiscourseTopicChat::GuardianExtensions

  def can_moderate_chat?(topic)
    can_perform_action_available_to_group_moderators?(topic)
  end

  def can_enable_chat?(topic)
    can_moderate_chat?(topic)
  end

  def can_chat?(user)
    SiteSetting.topic_chat_restrict_to_staff ? user&.staff? : true
  end

  def can_chat_in_topic?(topic_chat_record)
    topic = topic_chat_record.topic
    # TODO: separate chatting permission?

    can_create_post?(topic) && !topic.closed? && !topic.archived?
  end

  def can_flag_chats?(topic)
    # TODO: SiteSetting.allow_flagging_staff is ignored

    return false if @user.silenced?

    @user.has_trust_level?(TrustLevel[SiteSetting.min_trust_to_flag_posts])
  end

  def can_delete_chat?(message, topic)
    message.user_id == current_user.id ?
      can_delete_own_chats?(topic) :
      can_delete_other_chats?(topic)
  end

  def can_delete_own_chats?(topic)
    return false if !can_see_topic?(topic)
    return false if topic.archived?
    return true if can_moderate_chat?(topic)
    return false if (SiteSetting.max_post_deletions_per_day < 1)
    true
  end

  def can_delete_other_chats?(topic)
    return false if topic.archived?
    return true if can_moderate_chat?(topic)
    false
  end

  def can_restore_chat?(message, topic)
    message.user_id == current_user.id ?
      can_restore_own_chats?(topic) :
      can_delete_other_chats?(topic)
  end

  def can_restore_own_chats?(topic)
    return false if !can_see_topic?(topic)
    return false if topic.archived?
    true
  end

  def can_restore_other_chats?(topic)
    return false if topic.archived?
    can_moderate_chat?(topic)
  end
end
