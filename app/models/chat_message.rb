# frozen_string_literal: true

class ChatMessage < ActiveRecord::Base
  include Trashable
  self.ignored_columns = ["post_id"]
  attribute :has_oneboxes, default: false

  BAKED_VERSION = 2

  belongs_to :chat_channel
  belongs_to :user
  belongs_to :in_reply_to, class_name: "ChatMessage"
  has_many :revisions, class_name: "ChatMessageRevision"
  has_many :reactions, class_name: "ChatMessageReaction"
  has_many :chat_message_post_connections, dependent: :destroy
  has_many :posts, through: :chat_message_post_connections
  has_many :chat_uploads
  has_many :uploads, through: :chat_uploads
  has_one :chat_webhook_event

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

  def validate_message
    WatchedWordsValidator.new(attributes: [:message]).validate(self)
  end

  def excerpt
    PrettyText.excerpt(cooked, 50, {})
  end

  def push_notification_excerpt
    message[0...400]
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
    category-hashtag
    censored
    discourse-local-dates
    emoji
    emojiShortcuts
    inlineEmoji
    html-img
    mentions
    onebox
    text-post-process
    upload-protocol
    watched-words
    table
    spoiler-alert
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
    cooked = PrettyText.cook(message, features_override: MARKDOWN_FEATURES, markdown_it_rules: MARKDOWN_IT_RULES)

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
#  action_code     :string
#  cooked          :text
#  cooked_version  :integer
#
# Indexes
#
#  index_chat_messages_on_chat_channel_id_and_created_at  (chat_channel_id,created_at)
#  index_chat_messages_on_post_id                         (post_id)
#
