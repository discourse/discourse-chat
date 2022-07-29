# frozen_string_literal: true

class ChatMessage < ActiveRecord::Base
  include Trashable
  attribute :has_oneboxes, default: false

  BAKED_VERSION = 2

  belongs_to :chat_channel
  belongs_to :user
  belongs_to :in_reply_to, class_name: "ChatMessage"
  has_many :replies, class_name: "ChatMessage", foreign_key: "in_reply_to_id", dependent: :nullify
  has_many :revisions, class_name: "ChatMessageRevision", dependent: :destroy
  has_many :reactions, class_name: "ChatMessageReaction", dependent: :destroy
  has_many :bookmarks, as: :bookmarkable, dependent: :destroy
  has_many :chat_uploads, dependent: :destroy
  has_many :uploads, through: :chat_uploads
  has_one :chat_webhook_event, dependent: :destroy
  has_one :chat_mention, dependent: :destroy

  scope :in_public_channel,
        -> {
          joins(:chat_channel).where(
            chat_channel: {
              chatable_type: ChatChannel.public_channel_chatable_types,
            },
          )
        }

  scope :in_dm_channel,
        -> { joins(:chat_channel).where(chat_channel: { chatable_type: "DirectMessageChannel" }) }

  scope :created_before, ->(date) { where("chat_messages.created_at < ?", date) }

  def validate_message(has_uploads:)
    WatchedWordsValidator.new(attributes: [:message]).validate(self)
    DiscourseChat::DuplicateMessageValidator.new(self).validate

    if !has_uploads && message_too_short?
      self.errors.add(
        :base,
        I18n.t(
          "chat.errors.minimum_length_not_met",
          minimum: SiteSetting.chat_minimum_message_length,
        ),
      )
    end
  end

  def attach_uploads(uploads)
    return if uploads.blank?

    now = Time.now
    record_attrs =
      uploads.map do |upload|
        { upload_id: upload.id, chat_message_id: self.id, created_at: now, updated_at: now }
      end
    ChatUpload.insert_all!(record_attrs)
  end

  def excerpt
    # just show the URL if the whole message is a URL, because we cannot excerpt oneboxes
    return message if UrlHelper.relaxed_parse(message).is_a?(URI)

    # upload-only messages are better represented as the filename
    return uploads.first.original_filename if cooked.blank? && uploads.present?

    # this may return blank for some complex things like quotes, that is acceptable
    PrettyText.excerpt(cooked, 50, {})
  end

  def cooked_for_excerpt
    (cooked.blank? && uploads.present?) ? "<p>#{uploads.first.original_filename}</p>" : cooked
  end

  def push_notification_excerpt
    Emoji.gsub_emoji_to_unicode(message).truncate(400)
  end

  def add_flag(user)
    reviewable = ReviewableChatMessage.needs_review!(created_by: user, target: self)
    reviewable.update(target_created_by: self.user)
    reviewable.add_score(user, ReviewableScore.types[:needs_review], force_review: true)
    reviewable
  end

  def reviewable_score_for(user)
    ReviewableScore.joins(:reviewable).where(reviewable: { target: self }).where(user: user)
  end

  def to_markdown
    markdown = []

    if self.message.present?
      msg = self.message

      self.chat_uploads.any? ? markdown << msg + "\n" : markdown << msg
    end

    self
      .chat_uploads
      .order(:created_at)
      .each { |chat_upload| markdown << UploadMarkdown.new(chat_upload.upload).to_markdown }

    markdown.reject(&:empty?).join("\n")
  end

  def cook
    self.cooked = self.class.cook(self.message)
    self.cooked_version = BAKED_VERSION
  end

  def rebake!(invalidate_oneboxes: false, priority: nil)
    previous_cooked = self.cooked
    new_cooked = self.class.cook(message, invalidate_oneboxes: invalidate_oneboxes)
    update_columns(cooked: new_cooked, cooked_version: BAKED_VERSION)
    args = { chat_message_id: self.id }
    args[:queue] = priority.to_s if priority && priority != :normal
    args[:is_dirty] = true if previous_cooked != new_cooked

    Jobs.enqueue(:process_chat_message, args)
  end

  def self.uncooked
    where("cooked_version <> ? or cooked_version IS NULL", BAKED_VERSION)
  end

  MARKDOWN_FEATURES = %w[
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
  ]

  MARKDOWN_IT_RULES = %w[
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
  ]

  def self.cook(message, opts = {})
    cooked =
      PrettyText.cook(
        message,
        features_override: MARKDOWN_FEATURES + DiscoursePluginRegistry.chat_markdown_features.to_a,
        markdown_it_rules: MARKDOWN_IT_RULES,
        force_quote_link: true,
      )

    result =
      Oneboxer.apply(cooked) do |url|
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

  def full_url
    "#{Discourse.base_url}#{url}"
  end

  def url
    "/chat/message/#{self.id}"
  end

  private

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
#  idx_chat_messages_by_created_at_not_deleted            (created_at) WHERE (deleted_at IS NULL)
#  index_chat_messages_on_chat_channel_id_and_created_at  (chat_channel_id,created_at)
#
