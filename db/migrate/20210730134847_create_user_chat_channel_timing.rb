class CreateUserChatChannelTiming < ActiveRecord::Migration[6.1]
  def change
    create_table :user_chat_channel_timings do |t|
      t.integer :chat_channel_id, null: false
      t.integer :chat_message_id, null: false
      t.integer :user_id, null: false
    end

    add_index :user_chat_channel_timings, [:chat_channel_id, :user_id, :chat_message_id], name: "user_chat_channel_timings_index"
  end
end
