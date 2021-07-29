# frozen_string_literal: true

class ChatMessageRevision < ActiveRecord::Base
  belongs_to :chat_message
end
