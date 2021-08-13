# frozen_string_literal: true

class DirectMessageUser < ActiveRecord::Base
  belongs_to :directory_message_channel
  belongs_to :user
end
