# frozen_string_literal: true

class DropUserChatChannelLastReads < ActiveRecord::Migration[7.0]
  def up
    # usage has been dropped in https://github.com/discourse/discourse-chat/commit/1c110b71b28411dc7ac3ab9e3950e0bbf38d7970
    # but apparently table never got dropped
    drop_table :user_chat_channel_last_reads
  end
end
