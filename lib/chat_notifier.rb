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
      timestamp: @timestamp
    })
  end

  def cooked_mentions
    @cooked_mentions ||= Nokogiri::HTML5.fragment(@chat_message.cooked).css(".mention").map(&:text)
  end

  def mentioned_usernames
    # Drop the `@` character from start of each mention
    @mentioned_usernames ||= cooked_mentions.map { |mention| mention[1..-1] }
  end

  def set_mentioned_users
    if cooked_mentions.include?("@all")
      users = members_of_channel(exclude: @user.username)
    else
      users = cooked_mentions.include?("@here") ?
        users_here :
        mentioned_by_username(
          exclude: @user.username,
          usernames: mentioned_usernames
        )
    end

    can_chat_users, @cannot_chat_users = filter_users_who_can_chat(users)
    @mentioned_with_membership, @mentioned_without_membership = filter_with_and_without_membership(can_chat_users)
  end

  def users_here
    users = members_of_channel(exclude: @user.username).where("last_seen_at > ?", 5.minutes.ago)
    usernames = users.map(&:username)
    other_mentioned_usernames = mentioned_usernames
      .reject { |username| username == "here" || usernames.include?(username) }
    if other_mentioned_usernames.any?
      users = users.or(
        members_of_channel(
          exclude: @user.username,
          usernames: other_mentioned_usernames
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

  def members_of_channel(exclude:, usernames: nil)
    users = users_preloaded_query
      .where(user_chat_channel_memberships: { following: true, chat_channel_id: @chat_channel.id })
      .where.not(username_lower: exclude.downcase)
    users = users.where(username_lower: usernames.map(&:downcase)) if usernames
    users
  end

  def users_preloaded_query
    User
      .includes(:do_not_disturb_timings, :push_subscriptions, :groups, :user_chat_channel_memberships)
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
      timestamp: @timestamp
    })
  end
end
