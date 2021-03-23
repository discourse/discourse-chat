# frozen_string_literal: true

class TopicChatMessageSerializer < ApplicationSerializer
  attributes :message,
    :post_id,
    :created_at,
    :in_reply_to_id,
    :deleted_at,
    :deleted_by_id,
    :flag_count

  has_one :user, serializer: BasicUserSerializer, root: :users

  def include_deleted_at?
    !object.deleted_at.nil?
  end

  def include_deleted_by_id?
    !object.deleted_at.nil?
  end

  def flag_count
    0 # TODO: flagging
    # object.flag_count
  end

  def include_flag_count?
    scope.can_see_flags?(object.topic) && (false && object.flag_count > 0)
  end
end
