# frozen_string_literal: true

class ChatMessage < ActiveRecord::Base
  include Trashable
  attribute :has_oneboxes, default: false

  # TODO (martin) Drop both these columns right after they are ignored,
  # the post_id has been ignored for ages and action_code is not used.
  self.ignored_columns = [
    "post_id",
    "action_code"
  ]

  BAKED_VERSION = 2

  belongs_to :chat_channel
  belongs_to :user
  belongs_to :in_reply_to, class_name: "ChatMessage"
  has_many :revisions, class_name: "ChatMessageRevision"
  has_many :reactions, class_name: "ChatMessageReaction"
  has_many :chat_uploads
  has_many :uploads, through: :chat_uploads
  has_one :chat_webhook_event
  has_one :chat_mention

  scope :in_public_channel, -> {
    joins(:chat_channel)
      .where(chat_channel: { chatable_type: ChatChannel.public_channel_chatable_types })
  }

  scope :in_dm_channel, -> {
    joins(:chat_channel)
      .where(chat_channel: { chatable_type: "DirectMessageChannel" })
  }

  scope :created_before, -> (date) {
    where("chat_messages.created_at < ?", date)
  }

  def validate_message(has_uploads:)
    WatchedWordsValidator.new(attributes: [:message]).validate(self)
    if block_duplicate?
      self.errors.add(:base, I18n.t("chat.errors.duplicate_message"))
    end

    if !has_uploads && message_too_short?
      self.errors.add(
        :base,
        I18n.t("chat.errors.minimum_length_not_met", minimum: SiteSetting.chat_minimum_message_length)
      )
    end
  end

  def attach_uploads(uploads)
    return if uploads.blank?

    now = Time.now
    record_attrs = uploads.map do |upload|
      {
        upload_id: upload.id,
        chat_message_id: self.id,
        created_at: now,
        updated_at: now
      }
    end
    ChatUpload.insert_all!(record_attrs)
  end

  def excerpt
    cooked_or_uploads = cooked.blank? && uploads.present? ? "<p>#{uploads.first.original_filename}</p>" : cooked
    pretty_excerpt = PrettyText.excerpt(cooked_or_uploads, 50, {})
    pretty_excerpt.blank? ? message : pretty_excerpt
  end

  def push_notification_excerpt
    Emoji.gsub_emoji_to_unicode(message).truncate(400)
  end

  def add_flag(user)
    reviewable = ReviewableChatMessage.needs_review!(
      created_by: user,
      target: self,
    )
    reviewable.update(target_created_by: self.user)
    reviewable.add_score(
      user,
      ReviewableScore.types[:needs_review],
      force_review: true
    )
    reviewable
  end

  def reviewable_score_for(user)
    ReviewableScore.joins(:reviewable).where(reviewable: { target: self }).where(user: user)
  end

  def to_markdown
    markdown = []

    if self.message.present?
      msg = self.message

      if self.chat_uploads.any?
        markdown << msg + "\n"
      else
        markdown << msg
      end
    end

    self.chat_uploads.order(:created_at).each do |chat_upload|
      markdown << UploadMarkdown.new(chat_upload.upload).to_markdown
    end

    markdown.reject(&:empty?).join("\n")
  end

  def cook
    self.cooked = self.class.cook(self.message)
    self.cooked_version = BAKED_VERSION
  end

  def rebake!(invalidate_oneboxes: false, priority: nil)
    previous_cooked = self.cooked
    new_cooked = self.class.cook(message, invalidate_oneboxes: invalidate_oneboxes)
    update_columns(
      cooked: new_cooked,
      cooked_version: BAKED_VERSION
    )
    args = {
      chat_message_id: self.id,
    }
    args[:queue] = priority.to_s if priority && priority != :normal
    args[:is_dirty] = true if previous_cooked != new_cooked

    Jobs.enqueue(:process_chat_message, args)
  end

  def self.uncooked
    where('cooked_version <> ? or cooked_version IS NULL', BAKED_VERSION)
  end

  MARKDOWN_FEATURES = %w{
    anchor
    bbcode-block
    bbcode-inline
    code
    category-hashtag
    censored
    discourse-chat-transcript
    discourse-local-dates
    emoji
    emojiShortcuts
    inlineEmoji
    html-img
    mentions
    onebox
    quotes
    spoiler-alert
    table
    text-post-process
    upload-protocol
    watched-words
  }

  MARKDOWN_IT_RULES = %w{
    autolink
    list
    backticks
    newline
    code
    fence
    image
    table
    linkify
    link
    strikethrough
    blockquote
    emphasis
  }

  def self.cook(message, opts = {})
    cooked = PrettyText.cook(
      message,
      features_override: MARKDOWN_FEATURES,
      markdown_it_rules: MARKDOWN_IT_RULES,
      force_quote_link: true
    )

    result = Oneboxer.apply(cooked) do |url|
      if opts[:invalidate_oneboxes]
        Oneboxer.invalidate(url)
        InlineOneboxer.invalidate(url)
      end
      onebox = Oneboxer.cached_onebox(url)
      onebox
    end

    cooked = result.to_html if result.changed?
    cooked
  end

  def url
    "#{Discourse.base_url}/chat/channel/#{self.chat_channel_id}/chat?messageId=#{self.id}"
  end

  private

  def block_duplicate?
    sensitivity = SiteSetting.chat_duplicate_message_sensitivity
    return false if sensitivity.zero?

    # Check if the length of the message is too short to check for a duplicate message
    return false if message.length < calc_min_message_length_for_duplicates(sensitivity)

    # Check if there are enough users in the channel to check for a duplicate message
    return false if (chat_channel.user_count || 0) < calc_min_user_count_for_duplicates(sensitivity)

    chat_channel.chat_messages
      .where("created_at > ?", calc_in_the_past_seconds_for_duplicates(sensitivity).seconds.ago)
      .where(message: message)
      .exists?
  end

  def calc_min_user_count_for_duplicates(sensitivity)
    # Line generated from 0.1 sensitivity = 100 users and 1.0 sensitivity = 5 users.
    (-1.0 * 105.5 * sensitivity + 110.55).to_i
  end

  def calc_min_message_length_for_duplicates(sensitivity)
    # Line generated from 0.1 sensitivity = 30 chars and 1.0 sensitivity = 10 chars.
    (-1.0 * 22.2 * sensitivity + 32.22).to_i
  end

  def calc_in_the_past_seconds_for_duplicates(sensitivity)
    # Line generated from 0.1 sensitivity = 10 seconds and 1.0 sensitivity = 60 seconds.
    (55.55 * sensitivity + 4.5).to_i
  end

  def message_too_short?
    message.length < SiteSetting.chat_minimum_message_length
  end
end

# == Schema Information
#
# Table name: chat_messages
#
#  id              :bigint           not null, primary key
#  chat_channel_id :integer          not null
#  user_id         :integer
#  created_at      :datetime         not null
#  updated_at      :datetime         not null
#  deleted_at      :datetime
#  deleted_by_id   :integer
#  in_reply_to_id  :integer
#  message         :text
#  cooked          :text
#  cooked_version  :integer
#
# Indexes
#
#  index_chat_messages_on_chat_channel_id_and_created_at  (chat_channel_id,created_at)
#
