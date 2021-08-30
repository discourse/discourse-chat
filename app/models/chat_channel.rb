# frozen_string_literal: true

class ChatChannel < ActiveRecord::Base
  include Trashable
  attribute :chat_channels, default: []

  belongs_to :chatable, polymorphic: true
  has_many :chat_messages
  has_many :user_chat_channel_last_reads

  def chatable_url
    return nil if direct_message_channel?

    site_channel? ?
      Discourse.base_url :
      chatable.url
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

  def site_channel?
    chatable_type == DiscourseChat::SITE_CHAT_TYPE
  end

  def title(user)
    case chatable_type
    when "Topic"
      object.chatable.title.parameterize
    when "Category"
      chatable.name
    when "Site"
      I18n.t("chat.site_chat_name")
    when "DirectMessageChannel"
      chatable.chat_channel_title_for_user(self, user)
    end
  end

  def self.public_channels
    where(chatable_type: ["Topic", "Category", DiscourseChat::SITE_CHAT_TYPE])
  end

  def self.site_channel
    find_by(chatable_id: DiscourseChat::SITE_CHAT_ID)
  end

  def self.is_enabled?(t)
    return false if !SiteSetting.topic_chat_enabled

    ChatChannel.where(chatable: topic).exists?
  end
end
