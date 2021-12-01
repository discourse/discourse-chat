# frozen_string_literal: true

class ChatBaseMessageSerializer < ApplicationSerializer
  attributes :id,
    :message,
    :cooked,
    :action_code,
    :created_at,
    :excerpt,
    :in_reply_to_id,
    :deleted_at,
    :deleted_by_id,
    :flag_count,
    :edited,
    :reactions,
    :users_reactions

  has_one :user, serializer: BasicUserSerializer, embed: :objects
  has_one :chat_webhook_event, serializer: ChatWebhookEventSerializer, embed: :objects
  has_one :in_reply_to, serializer: ChatBaseMessageSerializer, embed: :objects
  has_many :uploads, serializer: UploadSerializer, embed: :objects

  def reactions
    reactions_hash = {}
    object.reactions.group_by(&:emoji).each do |emoji, reactions|
      users = reactions[0..11].map(&:user).filter { |user| user.id != scope.user.id }[0..10]
      reactions_hash[emoji] = {
        count: reactions.count,
        users: ActiveModel::ArraySerializer.new(users, each_serializer: BasicUserSerializer).as_json
      }
    end
    reactions_hash
  end

  def users_reactions
    object.reactions.select { |reaction| reaction.user_id == scope.user.id }.map(&:emoji)
  end

  def edited
    true
  end

  def include_edited?
    object.revisions.any?
  end

  def include_deleted_at?
    !object.deleted_at.nil?
  end

  def include_deleted_by_id?
    !object.deleted_at.nil?
  end

  def include_in_reply_to_id?
    object.in_reply_to_id.presence
  end

  def flag_count
    0 # TODO: flagging
    # object.flag_count / ReviewableSomethingOrOther
  end

  def include_flag_count?
    scope.can_see_flags?(object.chat_channel.chatable) && (false && object.flag_count > 0)
  end
end
