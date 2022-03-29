# frozen_string_literal: true
class DiscourseChat::ChatNotifier
  def self.user_has_seen_message?(membership, chat_message_id)
    (membership.last_read_message_id || 0) >= chat_message_id
  end

  def self.push_notification_tag(type, chat_channel_id)
    "#{Discourse.current_hostname}-chat-#{type}-#{chat_channel_id}"
  end

  def self.notify_edit(chat_message:, timestamp:)
    instance = new(chat_message, timestamp)
    instance.notify_edit
  end

  def self.notify_new(chat_message:, timestamp:)
    instance = new(chat_message, timestamp)
    instance.notify_new
  end

  def initialize(chat_message, timestamp)
    @chat_message = chat_message
    @timestamp = timestamp
    @chat_channel = @chat_message.chat_channel
    @user = @chat_message.user
  end

  def notify_edit
    update_mention_notifications
  end

  def notify_new
    mentioned_user_ids = create_mention_notifications
    notify_watching_users(except: [@user.id] + mentioned_user_ids)
    user_ids_to_identifier_map
  end

  private

  def update_mention_notifications
    existing_notifications = ChatMention.includes(:user, :notification).where(chat_message: @chat_message)
    already_notified_user_ids = existing_notifications.map(&:user_id)
    set_mentioned_users
    mentioned_user_ids = @mentioned_with_membership.map(&:id)

    needs_deletion = already_notified_user_ids - mentioned_user_ids
    needs_deletion.each do |user_id|
      chat_mention = existing_notifications.detect { |n| n.user_id == user_id }
      chat_mention.notification.destroy!
      chat_mention.destroy!
    end

    needs_notification_ids = mentioned_user_ids - already_notified_user_ids
    return if needs_notification_ids.blank?

    notify_creator_of_inaccessible_mentions
    enqueue_mentioned_job(needs_notification_ids)
  end

  def create_mention_notifications
    mentioned_user_ids = []
    set_mentioned_users

    @mentioned_with_membership.each do |target_user|
      mentioned_user_ids.push(target_user.id)
      ChatPublisher.publish_new_mention(target_user, @chat_channel.id, @chat_message.id)
    end

    notify_creator_of_inaccessible_mentions
    enqueue_mentioned_job(mentioned_user_ids)
    mentioned_user_ids
  end

  def notify_creator_of_inaccessible_mentions
    if @cannot_chat_users.any? || @mentioned_without_membership.any?
      ChatPublisher.publish_inaccessible_mentions(@user, @chat_message, @cannot_chat_users, @mentioned_without_membership)
    end
  end

  def enqueue_mentioned_job(user_ids)
    Jobs.enqueue_in(3.seconds, :create_chat_mention_notifications, {
      chat_message_id: @chat_message.id,
      user_ids: user_ids,
      user_ids_to_identifier_map: user_ids_to_identifier_map.as_json,
      user_ids_to_group_mention_map: user_ids_to_group_mention_map,
      timestamp: @timestamp.iso8601(6)
    })
  end

  def user_ids_to_identifier_map
    # A user might be directly mentioned by username, @here, @all, @group_name or a combo.
    # Here we need to set the identifier if the user wasn't mentioned directly so that both
    # OS notifications and core notifications can correctly display what identifier they were
    # mentioned by. Loop through @all, @here, then group mentions, finally directly mentioned user_ids with each loop
    # overriding the previous identifier so directly mentioned users will always be mentioned as such.
    @user_ids_to_identifier_map ||= begin
      map = {}
      [
        [@global_mentioned_users.map(&:id), :all],
        [@here_mentioned_users.map(&:id), :here]
      ].each do |user_ids, identifier|
        user_ids.each { |user_id| map[user_id] = { is_group: false, identifier: identifier } }
      end

      group_mentioned_users.each do |user|
        group_name = (user.groups.map(&:name) & group_name_mentions).first
        map[user.id] = { is_group: true, identifier: group_name }
      end

      @directly_mentioned_users.each { |user| map[user.id] = nil }
      map
    end
  end

  def direct_mentions_from_cooked
    @direct_mentions_from_cooked ||= Nokogiri::HTML5.fragment(@chat_message.cooked).css(".mention").map(&:text)
  end

  def group_name_mentions
    @group_mentions_from_cooked ||= Nokogiri::HTML5.fragment(@chat_message.cooked).css(".mention-group").map(&:text).map { |m| m[1..-1] }
  end

  def group_mentioned_users
    @group_mentioned_users ||= begin
                                 if group_name_mentions.empty?
                                   return []
                                 else
                                   mentionable_groups = Group
                                     .mentionable(@user, include_public: false)
                                     .where(name: group_name_mentions)
                                   users_preloaded_query(include_groups: false)
                                     .joins(:groups)
                                     .where(groups: mentionable_groups)
                                 end
                               end
  end

  def user_ids_to_group_mention_map
    map = {}
    group_mentioned_users.each do |user|
      group_name = (user.groups.map(&:name) & group_name_mentions).first
      map[user.id] = group_name
    end
    map
  end

  def mentioned_usernames
    # Drop the `@` character from start of each mention
    @mentioned_usernames ||= direct_mentions_from_cooked.map { |mention| mention[1..-1] }
  end

  def set_mentioned_users
    @global_mentioned_users = direct_mentions_from_cooked.include?("@all") ?
      members_of_channel(exclude: @user.username, is_channel_mention: true) :
      []

    @here_mentioned_users = direct_mentions_from_cooked.include?("@here") ? get_users_here : []

    @directly_mentioned_users = mentioned_by_username(
      exclude: @user.username,
      usernames: mentioned_usernames
    )

    users = (@global_mentioned_users + @here_mentioned_users + group_mentioned_users + @directly_mentioned_users).uniq

    can_chat_users, @cannot_chat_users = filter_users_who_can_chat(users)
    @mentioned_with_membership, @mentioned_without_membership = filter_with_and_without_membership(can_chat_users)
  end

  def get_users_here
    users = members_of_channel(exclude: @user.username, is_channel_mention: true).where("last_seen_at > ?", 5.minutes.ago)
    usernames = users.map(&:username)
    other_mentioned_usernames = mentioned_usernames
      .reject { |username| username == "here" || usernames.include?(username) }
    if other_mentioned_usernames.any?
      users = users.or(
        members_of_channel(
          exclude: @user.username,
          usernames: other_mentioned_usernames,
          is_channel_mention: true
        )
      )
    end

    users
  end

  def filter_with_and_without_membership(users)
    users.partition do |user|
      user.user_chat_channel_memberships.any? { |m| m.chat_channel_id == @chat_channel.id && m.following == true }
    end
  end

  def mentioned_by_username(exclude:, usernames:)
    users_preloaded_query.where(username_lower: (usernames.map(&:downcase) - [exclude.downcase]))
  end

  def members_of_channel(exclude:, usernames: nil, is_channel_mention: false)
    users = users_preloaded_query
      .where(user_chat_channel_memberships: { following: true, chat_channel_id: @chat_channel.id })
      .where.not(username_lower: exclude.downcase)
    users = users.where(username_lower: usernames.map(&:downcase)) if usernames
    users = users.where(user_options: { ignore_channel_wide_mention: [false, nil] }) if is_channel_mention
    users
  end

  def users_preloaded_query(include_groups: true)
    users = User.includes(:do_not_disturb_timings, :push_subscriptions, :user_chat_channel_memberships)

    if include_groups
      users = users.includes(:groups)
    end

    users
      .joins(:user_chat_channel_memberships)
      .joins(:user_option)
      .real
      .not_suspended
      .where(user_options: { chat_enabled: true })
  end

  def filter_users_who_can_chat(users)
    users.partition do |user|
      guardian = Guardian.new(user)
      guardian.can_chat?(user) && guardian.can_see_chat_channel?(@chat_channel)
    end
  end

  def notify_watching_users(except: [])
    Jobs.enqueue_in(3.seconds, :notify_users_watching_chat, {
      chat_message_id: @chat_message.id,
      except_user_ids: except,
      timestamp: @timestamp.iso8601(6)
    })
  end
end
