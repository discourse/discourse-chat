# frozen_string_literal: true

class TopicChatMessage < ActiveRecord::Base
  include Trashable

  belongs_to :post
  belongs_to :topic
  belongs_to :user

  belongs_to :in_reply_to, class_name: "TopicChatMessage"

  def reviewable_flag
    raise NotImplementedError
    #ReviewableFlaggedChat.pending.find_by(target: self)
  end
end
