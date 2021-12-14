# frozen_string_literal: true

class ChatMessage < ActiveRecord::Base
  include Trashable
  self.ignored_columns = ["post_id"]
  attribute :has_oneboxes, default: false

  BAKED_VERSION = 1

  belongs_to :chat_channel
  belongs_to :user
  belongs_to :in_reply_to, class_name: "ChatMessage"
  has_many :revisions, class_name: "ChatMessageRevision"
  has_many :reactions, class_name: "ChatMessageReaction"
  has_many :chat_message_post_connections
  has_many :posts, through: :chat_message_post_connections
  has_many :chat_uploads
  has_many :uploads, through: :chat_uploads
  has_one :chat_webhook_event

  def reviewable_flag
    raise NotImplementedError
    #ReviewableFlaggedChat.pending.find_by(target: self)
  end

  def excerpt
    PrettyText.excerpt(cooked, 50, {})
  end

  def push_notification_excerpt
    message[0...400]
  end

  def self.uncooked
    where('cooked_version <> ? or cooked_version IS NULL', BAKED_VERSION)
  end

  def self.cook(message, opts = {})
    cooked = PrettyText.cook(message, features: COOK_FEATURES)
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

  def cook
    self.cooked = self.class.cook(self.message)
    self.cooked_version = BAKED_VERSION
  end

  def rebake!(invalidate_oneboxes: false, priority: nil)
    new_cooked = self.class.cook(message, invalidate_oneboxes: invalidate_oneboxes)
    update_columns(
      cooked: new_cooked,
      cooked_version: BAKED_VERSION
    )
    args = {
      chat_message_id: self.id,
    }
    args[:queue] = priority.to_s if priority && priority != :normal

    Jobs.enqueue(:process_chat_message, args)
  end

  COOK_FEATURES = {
    anchor: true,
    "auto-link": true,
    bbcode: true,
    "bbcode-block": true,
    "bbcode-inline": true,
    "bold-italics": true,
    "category-hashtag": true,
    censored: true,
    checklist: false,
    code: true,
    "custom-typographer-replacements": false,
    "d-wrap": false,
    details: false,
    "discourse-local-dates": true,
    emoji: true,
    emojiShortcuts: true,
    html: false,
    "html-img": true,
    "inject-line-number": true,
    inlineEmoji: true,
    linkify: true,
    mentions: true,
    newline: true,
    onebox: true,
    paragraph: false,
    policy: false,
    poll: false,
    quote: true,
    quotes: true,
    "resize-controls": false,
    table: true,
    "text-post-process": true,
    unicodeUsernames: false,
    "upload-protocol": true,
    "watched-words": true,
  }
end
