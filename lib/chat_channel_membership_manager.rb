# frozen_string_literal: true

class DiscourseChat::ChatChannelMembershipManager
  def self.all_for_user(user)
    UserChatChannelMembership.where(user: user)
  end

  def self.find_for_user(user:, channel_id: nil, channel: nil, following: nil, initialize: false)
    ensure_channel_or_id_provided!(channel_id, channel)
    params = { user_id: user.id, chat_channel_id: channel_id || channel.id }
    params[:following] = following if following.present?

    if initialize
      UserChatChannelMembership.find_or_initialize_by(params)
    else
      UserChatChannelMembership.includes(:user, :chat_channel).find_by(params)
    end
  end

  def self.follow_channel(user:, channel_id: nil, channel: nil)
    ensure_channel_or_id_provided!(channel_id, channel)
    membership =
      find_for_user(user: user, channel_id: channel_id, channel: channel, initialize: true)

    ActiveRecord::Base.transaction do
      if !membership.following
        membership.following = true
        membership.save!
        recalculate_user_count!(channel_id || channel.id)
      end
    end

    membership
  end

  def self.unfollow_channel(user:, channel_id: nil, channel: nil)
    ensure_channel_or_id_provided!(channel_id, channel)

    membership = find_for_user(user: user, channel_id: channel_id, channel: channel)

    return if membership.blank?

    ActiveRecord::Base.transaction do
      if membership.following
        membership.update!(following: false)
        recalculate_user_count!(channel_id || channel.id)
      end
    end

    membership
  end

  def self.recalculate_user_count!(channel_id)
    return if ChatChannel.exists?(id: channel_id, user_count_stale: true)
    ChatChannel.update!(channel_id, user_count_stale: true)
    Jobs.enqueue_in(3.seconds, :update_channel_user_count, chat_channel_id: channel_id)
  end

  def self.unfollow_all_for_channel(channel)
    UserChatChannelMembership.where(chat_channel: channel).update_all(
      following: false,
      last_read_message_id: channel.chat_messages.last&.id,
    )
  end

  def self.enforce_automatic_channel_memberships(channel_id: nil, channel: nil)
    ensure_channel_or_id_provided!(channel_id, channel)
    Jobs.enqueue(:auto_manage_channel_memberships, chat_channel_id: channel_id || channel.id)
  end

  def self.enforce_automatic_user_membership(channel, user)
    Jobs.enqueue(
      :auto_join_channel_batch,
      chat_channel_id: channel.id,
      starts_at: user.id,
      ends_at: user.id,
    )
  end

  def self.ensure_channel_or_id_provided!(channel_id, channel)
    raise ArgumentError if channel_id.blank? && channel.blank?
  end
end
