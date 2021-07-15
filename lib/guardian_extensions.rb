# frozen_string_literal: true

module DiscourseChat::GuardianExtensions
  def can_access_site_chat?
    @user.staff?
  end

  def can_moderate_chat?(chatable)
    chatable.class.name == "Topic" ?
      can_perform_action_available_to_group_moderators?(chatable) :
      is_staff?
  end

  def can_chat?(user)
    SiteSetting.topic_chat_restrict_to_staff ? user&.staff? : true
  end

  def can_chat_in_chatable?(chatable)
    chatable.class.name == "Topic" ?
      can_create_post?(chatable) && !chatable.closed? && !chatable.archived? :
      true
  end

  def can_flag_chats?
    # TODO: SiteSetting.allow_flagging_staff is ignored

    return false if @user.silenced?

    @user.has_trust_level?(TrustLevel[SiteSetting.min_trust_to_flag_posts])
  end

  def can_delete_chat?(message, topic)
    message.user_id == current_user.id ?
      can_delete_own_chats?(topic) :
      can_delete_other_chats?(topic)
  end

  def can_delete_own_chats?(chatable)
    return false if (SiteSetting.max_post_deletions_per_day < 1)
    return true if can_moderate_chat?(chatable)

    if chatable.class.name == "Topic"
      return false if !can_see_topic?(chatable)
      return false if chatable.archived?
      return false if chatable.closed?
    end

    true
  end

  def can_delete_other_chats?(chatable)
    if chatable.class.name == "Topic"
      return false if chatable.archived?
      return false if chatable.closed?
    end
    return true if can_moderate_chat?(chatable)

    false
  end

  def can_restore_chat?(message, chatable)
    message.user_id == current_user.id ?
      can_restore_own_chats?(chatable) :
      can_delete_other_chats?(chatable) end

  def can_restore_own_chats?(chatable)
    if chatable.class.name == "Topic"
      return false if !can_see_topic?(chatable)
      return false if chatable.archived? || chatable.closed?
    else
      return false if !can_see_category?(chatable)
    end

    true
  end

  def can_restore_other_chats?(chatable)
    if chatable.class.name == "Topic"
      return false if chatable.archived?
    end

    can_moderate_chat?(chatable)
  end
end
