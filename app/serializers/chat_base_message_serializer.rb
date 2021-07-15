# frozen_string_literal: true

class ChatBaseMessageSerializer < ApplicationSerializer
  attributes :id,
    :message,
    :action_code,
    :post_id,
    :created_at,
    :in_reply_to_id,
    :deleted_at,
    :deleted_by_id,
    :flag_count

  has_one :user, serializer: BasicUserSerializer, embed: :objects

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
    object.chat_channel.chatable_type == DiscourseChat::SITE_CHAT_TYPE ?
      true :
      scope.can_see_flags?(object.chat_channel.chatable) && (false && object.flag_count > 0)
  end
end
