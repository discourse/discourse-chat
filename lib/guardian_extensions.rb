# frozen_string_literal: true

module DiscourseChat::GuardianExtensions
  def can_moderate_chat?(chatable)
    chatable.class.name == "Topic" ?
      can_perform_action_available_to_group_moderators?(chatable) :
      is_staff?
  end

  def can_chat?(user)
    return false unless user

    allowed_group_ids = DiscourseChat.allowed_group_ids
    return true if allowed_group_ids.include?(Group::AUTO_GROUPS[:everyone])

    (allowed_group_ids & user.group_ids).any?
  end

  def hidden_tag_names
    @hidden_tag_names ||= DiscourseTagging.hidden_tag_names(self)
  end

  def can_see_chat_channel?(chat_channel)
    if chat_channel.topic_channel?
      return false unless chat_channel.chatable

      !chat_channel.chatable.closed &&
        !chat_channel.chatable.archived &&
        can_see_topic?(chat_channel.chatable)
    elsif chat_channel.direct_message_channel?
      chat_channel.chatable.user_can_access?(user)
    elsif chat_channel.category_channel?
      return false unless chat_channel.chatable

      can_see_category?(chat_channel.chatable)
    elsif chat_channel.tag_channel?
      !hidden_tag_names.include?(chat_channel.chatable.name)
    else
      true
    end
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

  def can_edit_chat?(message)
    message.user_id == @user.id
  end
end
