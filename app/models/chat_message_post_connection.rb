# frozen_string_literal: true

class ChatMessagePostConnection < ActiveRecord::Base
  belongs_to :chat_message
  belongs_to :post
end
