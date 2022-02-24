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
  belongs_to :direct_message_channel, -> { where(chat_channels: { chatable_type: 'DirectMessageChannel' }) }, foreign_key: 'chatable_id'

  has_many :chat_messages
  has_many :user_chat_channel_memberships

  enum status: {
      open: 0,
      read_only: 1,
      closed: 2,
      archived: 3
  }, _scopes: false

  def open?
    self.status.to_sym == :open
  end

  def read_only?
    self.status.to_sym == :read_only
  end

  def closed?
    self.status.to_sym == :closed
  end

  def archived?
    self.status.to_sym == :archived
  end

  def status_name
    I18n.t("chat.channel.statuses.#{self.status}")
  end

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
      chatable.fancy_title
    when "Category"
      chatable.name
    when "Tag"
      chatable.name
    when "DirectMessageChannel"
      chatable.chat_channel_title_for_user(self, user)
    end
  end

  def change_status(acting_user, target_status)
    return if !ChatChannel.statuses.include?(target_status.to_s)
    return if !Guardian.new(acting_user).can_change_channel_status?(self, target_status)
    old_status = self.status
    self.update!(status: target_status)
    log_channel_status_change(
      acting_user: acting_user,
      new_status: target_status,
      old_status: old_status
    )
  end

  def open!(acting_user)
    change_status(acting_user, :open)
  end

  def read_only!(acting_user)
    change_status(acting_user, :read_only)
  end

  def close!(acting_user)
    change_status(acting_user, :closed)
  end

  def archive!(acting_user)
    change_status(acting_user, :archived)
  end

  def self.chatable_types
    public_channel_chatable_types << "DirectMessageChannel"
  end

  def self.public_channel_chatable_types
    ["Topic", "Category", "Tag"]
  end

  def self.public_channels
    where(chatable_type: public_channel_chatable_types)
  end

  def self.is_enabled?(t)
    return false if !SiteSetting.chat_enabled

    ChatChannel.where(chatable: topic).exists?
  end

  private

  def log_channel_status_change(acting_user:, new_status:, old_status:)
    new_status = new_status.to_sym
    old_status = old_status.to_sym

    DiscourseEvent.trigger(
      :chat_channel_status_change,
      channel: self,
      old_status: old_status,
      new_status: new_status
    )

    StaffActionLogger.new(acting_user).log_custom(
      "chat_channel_status_change",
      {
        chat_channel_id: self.id,
        chat_channel_name: self.name,
        previous_value: old_status,
        new_value: new_status
      }
    )

    ChatPublisher.publish_channel_status(self)
  end
end

# == Schema Information
#
# Table name: chat_channels
#
#  id                      :bigint           not null, primary key
#  chatable_id             :integer          not null
#  deleted_at              :datetime
#  deleted_by_id           :integer
#  featured_in_category_id :integer
#  delete_after_seconds    :integer
#  chatable_type           :string           not null
#  created_at              :datetime         not null
#  updated_at              :datetime         not null
#  name                    :string
#  description             :text
#  status                  :integer          default(0), not null
#
# Indexes
#
#  index_chat_channels_on_chatable_id                    (chatable_id)
#  index_chat_channels_on_chatable_id_and_chatable_type  (chatable_id,chatable_type)
#  index_chat_channels_on_status                         (status)
#
