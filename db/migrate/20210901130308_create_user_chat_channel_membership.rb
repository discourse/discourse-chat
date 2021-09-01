class CreateUserChatChannelMembership < ActiveRecord::Migration[6.1]
  def change
    create_table :user_chat_channel_memberships do |t|
      t.integer :user_id, null: false
      t.integer :chat_channel_id, null: false
      t.integer :last_read_message_id
      t.boolean :notification_sound, default: true, null: false
      t.integer :notification_level, default: 1, null: false
      t.boolean :following, default: false, null: false # membership on/off switch
      t.timestamps
    end

    add_index :user_chat_channel_memberships,
      [:user_id, :chat_channel_id, :notification_level, :following],
      name: "user_chat_channel_memberships_index"
  end
end
