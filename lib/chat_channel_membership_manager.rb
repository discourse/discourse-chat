# frozen_string_literal: true

class DiscourseChat::ChatChannelMembershipManager
  def self.all_for_user(user)
    UserChatChannelMembership.where(user: user)
  end

  def self.find_for_user(user:, channel:, following: nil)
    params = { user_id: user.id, chat_channel_id: channel.id }
    params[:following] = following if following.present?

    UserChatChannelMembership.includes(:user, :chat_channel).find_by(params)
  end

  def self.follow_channel(user:, channel:)
    membership =
      find_for_user(user: user, channel: channel) ||
        UserChatChannelMembership.new(user: user, chat_channel: channel, following: true)

    ActiveRecord::Base.transaction do
      if membership.new_record?
        membership.save!
        recalculate_user_count(channel)
      elsif !membership.following
        membership.update!(following: true)
        recalculate_user_count(channel)
      end
    end

    membership
  end

  def self.unfollow_channel(user:, channel:)
    membership = find_for_user(user: user, channel: channel)

    return if membership.blank?

    ActiveRecord::Base.transaction do
      if membership.following
        membership.update!(following: false)
        recalculate_user_count(channel)
      end
    end

    membership
  end

  def self.recalculate_user_count(channel)
    return if ChatChannel.exists?(id: channel.id, user_count_stale: true)
    channel.update!(user_count_stale: true)
    Jobs.enqueue_in(3.seconds, :update_channel_user_count, chat_channel_id: channel.id)
  end

  def self.unfollow_all_for_channel(channel)
    UserChatChannelMembership.where(chat_channel: channel).update_all(
      following: false,
      last_read_message_id: channel.chat_messages.last&.id,
    )
  end

  def self.enforce_automatic_channel_memberships(channel)
    Jobs.enqueue(:auto_manage_channel_memberships, chat_channel_id: channel.id)
  end

  def self.enforce_automatic_user_membership(channel, user)
    Jobs.enqueue(
      :auto_join_channel_batch,
      chat_channel_id: channel.id,
      starts_at: user.id,
      ends_at: user.id,
    )
  end
end
