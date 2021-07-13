# frozen_string_literal: true

class ChatMessage < ActiveRecord::Base
  include Trashable

  belongs_to :post
  belongs_to :chat_channel
  belongs_to :user

  belongs_to :in_reply_to, class_name: "ChatMessage"

  def reviewable_flag
    raise NotImplementedError
    #ReviewableFlaggedChat.pending.find_by(target: self)
  end
end
