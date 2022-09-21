# frozen_string_literal: true

class DiscourseChat::ChatChannelMembershipManager
  def self.all_for_user(user)
    UserChatChannelMembership.where(user: user)
  end

  def self.find_for_user(user:, channel_id: nil, channel: nil, following: nil, initialize: false)
    ensure_channel_or_id_provided!(channel_id, channel)
    params = { user: user, chat_channel_id: channel_id || channel.id }
    params[:following] = following if following.present?

    if initialize
      UserChatChannelMembership.find_or_initialize_by(params)
    else
      UserChatChannelMembership.includes(:user, :chat_channel).find(params)
    end
  end

  def self.follow_channel(user:, channel_id: nil, channel: nil)
    ensure_channel_or_id_provided!(channel_id, channel)
  end

  def self.unfollow_channel(user:, channel_id: nil, channel: nil)
    ensure_channel_or_id_provided!(channel_id, channel)
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
