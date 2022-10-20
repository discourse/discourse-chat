# frozen_string_literal: true

class ChatMessageSerializer < ApplicationSerializer
  attributes :id,
             :message,
             :cooked,
             :created_at,
             :excerpt,
             :deleted_at,
             :deleted_by_id,
             :reviewable_id,
             :user_flag_status,
             :edited,
             :reactions,
             :bookmark,
             :available_flags

  has_one :user, serializer: BasicUserWithStatusSerializer, embed: :objects
  has_one :chat_webhook_event, serializer: ChatWebhookEventSerializer, embed: :objects
  has_one :in_reply_to, serializer: ChatInReplyToSerializer, embed: :objects
  has_many :uploads, serializer: UploadSerializer, embed: :objects

  def user
    object.user || DeletedChatUser.new
  end

  def excerpt
    WordWatcher.censor(object.excerpt)
  end

  def reactions
    reactions_hash = {}
    object
      .reactions
      .group_by(&:emoji)
      .each do |emoji, reactions|
        users = reactions[0..6].map(&:user).filter { |user| user.id != scope&.user&.id }[0..5]

        next unless Emoji.exists?(emoji)

        reactions_hash[emoji] = {
          count: reactions.count,
          users:
            ActiveModel::ArraySerializer.new(users, each_serializer: BasicUserSerializer).as_json,
          reacted: users_reactions.include?(emoji),
        }
      end
    reactions_hash
  end

  def include_reactions?
    object.reactions.any?
  end

  def users_reactions
    @users_reactions ||=
      object.reactions.select { |reaction| reaction.user_id == scope&.user&.id }.map(&:emoji)
  end

  def users_bookmark
    @user_bookmark ||= object.bookmarks.find { |bookmark| bookmark.user_id == scope&.user&.id }
  end

  def include_bookmark?
    users_bookmark.present?
  end

  def bookmark
    {
      id: users_bookmark.id,
      reminder_at: users_bookmark.reminder_at,
      name: users_bookmark.name,
      auto_delete_preference: users_bookmark.auto_delete_preference,
      bookmarkable_id: users_bookmark.bookmarkable_id,
      bookmarkable_type: users_bookmark.bookmarkable_type,
    }
  end

  def edited
    true
  end

  def include_edited?
    object.revisions.any?
  end

  def deleted_at
    object.user ? object.deleted_at : Time.zone.now
  end

  def deleted_by_id
    object.user ? object.deleted_by_id : Discourse.system_user.id
  end

  def include_deleted_at?
    object.user ? !object.deleted_at.nil? : true
  end

  def include_deleted_by_id?
    object.user ? !object.deleted_at.nil? : true
  end

  def include_in_reply_to?
    object.in_reply_to_id.presence
  end

  def reviewable_id
    return @reviewable_id if defined?(@reviewable_id)
    return @reviewable_id = nil unless @options && @options[:reviewable_ids]

    @reviewable_id = @options[:reviewable_ids][object.id]
  end

  def include_reviewable_id?
    reviewable_id.present?
  end

  def user_flag_status
    return @user_flag_status if defined?(@user_flag_status)
    return @user_flag_status = nil unless @options&.dig(:user_flag_statuses)

    @user_flag_status = @options[:user_flag_statuses][object.id]
  end

  def include_user_flag_status?
    user_flag_status.present?
  end

  def available_flags
    return [] if !scope.can_flag_chat_message?(object)
    return [] if reviewable_id.present? && user_flag_status == ReviewableScore.statuses[:pending]

    channel = @options.dig(:chat_channel) || object.chat_channel

    PostActionType.flag_types.map do |sym, id|
      next if channel.direct_message_channel? && %i[notify_moderators notify_user].include?(sym)

      if sym == :notify_user &&
           (
             scope.current_user == user || user.bot? ||
               !scope.current_user.in_any_groups?(SiteSetting.personal_message_enabled_groups_map)
           )
        next
      end

      sym
    end
  end
end
