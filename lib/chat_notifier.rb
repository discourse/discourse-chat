# frozen_string_literal: true
class DiscourseChat::ChatNotifier
  class << self
    def user_has_seen_message?(membership, chat_message_id)
      (membership.last_read_message_id || 0) >= chat_message_id
    end

    def push_notification_tag(type, chat_channel_id)
      "#{Discourse.current_hostname}-chat-#{type}-#{chat_channel_id}"
    end

    def notify_edit(chat_message:, timestamp:)
      new(chat_message, timestamp).notify_edit
    end

    def notify_new(chat_message:, timestamp:)
      new(chat_message, timestamp).notify_new
    end
  end

  def initialize(chat_message, timestamp)
    @chat_message = chat_message
    @timestamp = timestamp
    @chat_channel = @chat_message.chat_channel
    @user = @chat_message.user
  end

  ### Public API

  def notify_new
    to_notify = list_users_to_notify
    inaccessible = to_notify.extract!(:unreachable, :welcome_to_join)
    mentioned_user_ids = to_notify.extract!(:all_mentioned_user_ids)[:all_mentioned_user_ids]

    mentioned_user_ids.each do |member_id|
      ChatPublisher.publish_new_mention(member_id, @chat_channel.id, @chat_message.id)
    end

    notify_creator_of_inaccessible_mentions(
      inaccessible[:unreachable], inaccessible[:welcome_to_join]
    )

    notify_mentioned_users(to_notify)
    notify_watching_users(except: mentioned_user_ids << @user.id)

    to_notify
  end

  def notify_edit
    existing_notifications = ChatMention.includes(:user, :notification).where(chat_message: @chat_message)
    already_notified_user_ids = existing_notifications.map(&:user_id)

    to_notify = list_users_to_notify
    inaccessible = to_notify.extract!(:unreachable, :welcome_to_join)
    mentioned_user_ids = to_notify.extract!(:all_mentioned_user_ids)[:all_mentioned_user_ids]

    needs_deletion = already_notified_user_ids - mentioned_user_ids
    needs_deletion.each do |user_id|
      chat_mention = existing_notifications.detect { |n| n.user_id == user_id }
      chat_mention.notification.destroy!
      chat_mention.destroy!
    end

    needs_notification_ids = mentioned_user_ids - already_notified_user_ids
    return if needs_notification_ids.blank?

    notify_creator_of_inaccessible_mentions(
      inaccessible[:unreachable], inaccessible[:welcome_to_join]
    )

    notify_mentioned_users(to_notify, already_notified_user_ids: already_notified_user_ids)

    to_notify
  end

  private

  def list_users_to_notify
    {}.tap do |to_notify|
      # The order of these methods is the precedence
      # between different mention types.

      already_covered_ids = []

      expand_direct_mentions(to_notify, already_covered_ids)
      expand_group_mentions(to_notify, already_covered_ids)
      expand_here_mention(to_notify, already_covered_ids)
      expand_global_mention(to_notify, already_covered_ids)

      to_notify[:all_mentioned_user_ids] = already_covered_ids
    end
  end

  def chat_users
    users = User.includes(:do_not_disturb_timings, :push_subscriptions, :user_chat_channel_memberships)

    users
      .distinct
      .joins('LEFT OUTER JOIN user_chat_channel_memberships uccm ON uccm.user_id = users.id')
      .joins(:user_option)
      .real
      .not_suspended
      .where(user_options: { chat_enabled: true })
      .where.not(username_lower: @user.username.downcase)
  end

  def rest_of_the_channel
    chat_users
      .where(user_chat_channel_memberships: { following: true, chat_channel_id: @chat_channel.id })
  end

  def members_accepting_channel_wide_notifications
    rest_of_the_channel.where(user_options: { ignore_channel_wide_mention: [false, nil] })
  end

  def direct_mentions_from_cooked
    @direct_mentions_from_cooked ||= Nokogiri::HTML5.fragment(@chat_message.cooked).css(".mention").map(&:text)
  end

  def normalized_mentions(mentions)
    mentions.reduce([]) do |memo, mention|
      %w[@here @all].include?(mention.downcase) ? memo : (memo << mention[1..-1].downcase)
    end
  end

  def expand_global_mention(to_notify, already_covered_ids)
    typed_global_mention = direct_mentions_from_cooked.include?("@all")

    if typed_global_mention
      to_notify[:global_mentions] = members_accepting_channel_wide_notifications
        .where.not(username_lower: normalized_mentions(direct_mentions_from_cooked))
        .where.not(id: already_covered_ids)
        .pluck(:id)

      already_covered_ids.concat(to_notify[:global_mentions])
    else
      to_notify[:global_mentions] = []
    end
  end

  def expand_here_mention(to_notify, already_covered_ids)
    typed_here_mention = direct_mentions_from_cooked.include?("@here")

    if typed_here_mention
      to_notify[:here_mentions] = members_accepting_channel_wide_notifications
        .where("last_seen_at > ?", 5.minutes.ago)
        .where.not(username_lower: normalized_mentions(direct_mentions_from_cooked))
        .where.not(id: already_covered_ids)
        .pluck(:id)

      already_covered_ids.concat(to_notify[:here_mentions])
    else
      to_notify[:here_mentions] = []
    end
  end

  def group_users_to_notify(users)
    potential_participants, unreachable = users.partition do |user|
      guardian = Guardian.new(user)
      guardian.can_chat?(user) && guardian.can_see_chat_channel?(@chat_channel)
    end

    participants, welcome_to_join = potential_participants.partition do |participant|
      participant.user_chat_channel_memberships.any? { |m| m.chat_channel_id == @chat_channel.id && m.following == true }
    end

    {
      already_participating: participants || [],
      welcome_to_join: welcome_to_join || [],
      unreachable: unreachable || []
    }
  end

  def expand_direct_mentions(to_notify, already_covered_ids)
    direct_mentions = chat_users
      .where(username_lower: normalized_mentions(direct_mentions_from_cooked))
      .where.not(id: already_covered_ids)

    grouped = group_users_to_notify(direct_mentions)

    to_notify[:direct_mentions] = grouped[:already_participating].map(&:id)
    to_notify[:welcome_to_join] = grouped[:welcome_to_join]
    to_notify[:unreachable] = grouped[:unreachable]
    already_covered_ids.concat(to_notify[:direct_mentions])
  end

  def group_name_mentions
    @group_mentions_from_cooked ||= Nokogiri::HTML5.fragment(@chat_message.cooked).css(".mention-group").map(&:text)
  end

  def mentionable_groups
    @mentionable_groups ||= Group.mentionable(@user, include_public: false)
      .where('LOWER(name) IN (?)', normalized_mentions(group_name_mentions))
  end

  def expand_group_mentions(to_notify, already_covered_ids)
    return [] if mentionable_groups.empty?

    mentionable_groups.each { |g| to_notify[g.name.downcase] = [] }

    reached_by_group = chat_users
      .joins(:groups).where(groups: mentionable_groups)
      .where.not(id: already_covered_ids)

    grouped = group_users_to_notify(reached_by_group)

    grouped[:already_participating].each do |user|
      group = user.groups.detect { |g| mentionable_groups.include?(g) }
      to_notify[group.name.downcase] << user.id
    end
    already_covered_ids.concat(grouped[:already_participating])

    to_notify[:welcome_to_join] = to_notify[:welcome_to_join].concat(grouped[:welcome_to_join])
    to_notify[:unreachable] = to_notify[:unreachable].concat(grouped[:unreachable])
  end

  def notify_creator_of_inaccessible_mentions(unreachable, welcome_to_join)
    return if unreachable.empty? && welcome_to_join.empty?

    ChatPublisher.publish_inaccessible_mentions(@user.id, @chat_message, unreachable, welcome_to_join)
  end

  def notify_mentioned_users(to_notify, already_notified_user_ids: [])
    Jobs.enqueue(:chat_notify_mentioned, {
      chat_message_id: @chat_message.id,
      to_notify_ids_map: to_notify.as_json,
      already_notified_user_ids: already_notified_user_ids,
      timestamp: @timestamp.iso8601(6)
    })
  end

  def notify_watching_users(except: [])
    Jobs.enqueue(:chat_notify_watching, {
      chat_message_id: @chat_message.id,
      except_user_ids: except,
      timestamp: @timestamp.iso8601(6)
    })
  end
end
