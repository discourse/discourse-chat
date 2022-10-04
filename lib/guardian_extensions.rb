# frozen_string_literal: true

module DiscourseChat::GuardianExtensions
  def can_moderate_chat?(chatable)
    case chatable.class.name
    when "Category"
      is_staff? || is_category_group_moderator?(chatable)
    else
      is_staff?
    end
  end

  def can_chat?(user)
    return false unless user

    allowed_group_ids = DiscourseChat.allowed_group_ids
    return true if allowed_group_ids.include?(Group::AUTO_GROUPS[:everyone])

    (allowed_group_ids & user.group_ids).any?
  end

  def can_create_chat_message?
    !SpamRule::AutoSilence.prevent_posting?(@user)
  end

  def can_create_direct_message?
    is_staff? || @user.in_any_groups?(SiteSetting.direct_message_enabled_groups_map)
  end

  def hidden_tag_names
    @hidden_tag_names ||= DiscourseTagging.hidden_tag_names(self)
  end

  def can_create_chat_channel?
    is_staff?
  end

  def can_delete_chat_channel?
    is_staff?
  end

  # Channel status intentionally has no bearing on whether the channel
  # name and description can be edited.
  def can_edit_chat_channel?
    is_staff?
  end

  def can_move_chat_messages?(channel)
    can_moderate_chat?(channel.chatable)
  end

  def can_create_channel_message?(chat_channel)
    valid_statuses = is_staff? ? %w[open closed] : ["open"]
    if chat_channel.direct_message_channel?
      can_create_direct_message? && valid_statuses.include?(chat_channel.status)
    else
      valid_statuses.include?(chat_channel.status)
    end
  end

  # This is intentionally identical to can_create_channel_message, we
  # may want to have different conditions here in future.
  def can_modify_channel_message?(chat_channel)
    return chat_channel.open? || chat_channel.closed? if is_staff?
    chat_channel.open?
  end

  def can_change_channel_status?(chat_channel, target_status)
    return false if chat_channel.status.to_sym == target_status.to_sym
    return false if !is_staff?

    case target_status
    when :closed
      chat_channel.open?
    when :open
      chat_channel.closed?
    when :archived
      chat_channel.read_only?
    when :read_only
      chat_channel.closed? || chat_channel.open?
    else
      false
    end
  end

  def can_rebake_chat_message?(message)
    return false if !can_modify_channel_message?(message.chat_channel)
    is_staff? || @user.has_trust_level?(TrustLevel[4])
  end

  def can_see_chat_channel?(chat_channel)
    return false unless chat_channel.chatable

    if chat_channel.direct_message_channel?
      chat_channel.chatable.user_can_access?(@user)
    elsif chat_channel.category_channel?
      can_see_category?(chat_channel.chatable)
    else
      true
    end
  end

  def can_flag_chat_messages?
    return false if @user.silenced?

    @user.in_any_groups?(SiteSetting.chat_message_flag_allowed_groups_map)
  end

  def can_flag_in_chat_channel?(chat_channel)
    return false if !can_modify_channel_message?(chat_channel)
    !chat_channel.direct_message_channel?
  end

  def can_flag_chat_message?(chat_message)
    return false if !authenticated? || !chat_message || chat_message.trashed? || !chat_message.user
    return false if chat_message.user.staff? && !SiteSetting.allow_flagging_staff
    return false if chat_message.user_id == @user.id

    can_flag_chat_messages? && can_flag_in_chat_channel?(chat_message.chat_channel)
  end

  def can_flag_message_as?(chat_message, flag_type_id, opts)
    return false if !is_staff? && (opts[:take_action] || opts[:queue_for_review])

    if flag_type_id == ReviewableScore.types[:notify_user]
      is_warning = ActiveRecord::Type::Boolean.new.deserialize(opts[:is_warning])

      return false if is_warning && !is_staff?
    end

    true
  end

  def can_delete_chat?(message, chatable)
    return false if @user.silenced?
    return false if !can_modify_channel_message?(message.chat_channel)

    if message.user_id == current_user.id
      can_delete_own_chats?(chatable)
    else
      can_delete_other_chats?(chatable)
    end
  end

  def can_delete_own_chats?(chatable)
    return false if (SiteSetting.max_post_deletions_per_day < 1)
    return true if can_moderate_chat?(chatable)

    true
  end

  def can_delete_other_chats?(chatable)
    return true if can_moderate_chat?(chatable)

    false
  end

  def can_restore_chat?(message, chatable)
    return false if !can_modify_channel_message?(message.chat_channel)

    if message.user_id == current_user.id
      case chatable.class.name
      when "Category"
        return can_see_category?(chatable)
      when "DirectMessageChannel"
        return true
      end
    end

    can_delete_other_chats?(chatable)
  end

  def can_restore_other_chats?(chatable)
    can_moderate_chat?(chatable)
  end

  def can_edit_chat?(message)
    message.user_id == @user.id && !@user.silenced?
  end

  def can_react?
    can_create_chat_message?
  end

  def can_delete_category?(category)
    super && !category.chat_channel
  end
end
