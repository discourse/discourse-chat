# frozen_string_literal: true

class ChatUpload < ActiveRecord::Base
  belongs_to :chat_message
  belongs_to :upload
end
