# frozen_string_literal: true

class ChatChannel < ActiveRecord::Base
  include Trashable
  attribute :muted, default: false
  attribute :desktop_notification_level, default: UserChatChannelMembership::DEFAULT_NOTIFICATION_LEVEL
  attribute :mobile_notification_level, default: UserChatChannelMembership::DEFAULT_NOTIFICATION_LEVEL
  attribute :following, default: false
  attribute :unread_count, default: 0
  attribute :unread_mentions, default: 0
  attribute :last_read_message_id, default: nil

  belongs_to :chatable, polymorphic: true
  has_many :chat_messages
  has_many :user_chat_channel_memberships

  def chatable_url
    return nil if direct_message_channel?
    return chatable.relative_url if topic_channel?

    chatable.url
  end

  def tag_channel?
    chatable_type == "Tag"
  end

  def topic_channel?
    chatable_type == "Topic"
  end

  def category_channel?
    chatable_type == "Category"
  end

  def direct_message_channel?
    chatable_type == "DirectMessageChannel"
  end

  def group_direct_message_channel?
    direct_message_channel? && chatable.users.count > 2
  end

  def chatable_has_custom_fields?
    topic_channel? || category_channel?
  end

  def allowed_user_ids
    direct_message_channel? ?
      chatable.user_ids :
      nil
  end

  def allowed_group_ids
    if category_channel?
      chatable.secure_group_ids
    elsif topic_channel? && chatable.category
      chatable.category.secure_group_ids
    else
      nil
    end
  end

  def public_channel_title
    return chatable.title.parameterize if topic_channel?

    chatable.name
  end

  def title(user)
    case chatable_type
    when "Topic"
      chatable.title.parameterize
    when "Category"
      chatable.name
    when "Tag"
      chatable.name
    when "DirectMessageChannel"
      chatable.chat_channel_title_for_user(self, user)
    end
  end

  def self.public_channels
    where(chatable_type: ["Topic", "Category", "Tag"])
  end

  def self.is_enabled?(t)
    return false if !SiteSetting.chat_enabled

    ChatChannel.where(chatable: topic).exists?
  end
end
