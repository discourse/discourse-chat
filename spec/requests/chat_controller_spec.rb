# frozen_string_literal: true

require 'rails_helper'

RSpec.describe DiscourseChat::ChatController do
  fab!(:user) { Fabricate(:user) }
  fab!(:other_user) { Fabricate(:user) }
  fab!(:admin) { Fabricate(:admin) }
  fab!(:category) { Fabricate(:category) }
  fab!(:topic) { Fabricate(:topic, category: category) }
  fab!(:chat_channel) { Fabricate(:chat_channel) }
  fab!(:dm_chat_channel) { Fabricate(:chat_channel, chatable: Fabricate(:direct_message_channel, users: [user, admin])) }
  fab!(:tag) { Fabricate(:tag) }

  MESSAGE_COUNT = 70
  MESSAGE_COUNT.times do |n|
    fab!("message_#{n}") { Fabricate(:chat_message, chat_channel: chat_channel, user: other_user, message: "message #{n}") }
  end

  before do
    SiteSetting.chat_enabled = true
    SiteSetting.chat_allowed_groups = Group::AUTO_GROUPS[:everyone]
  end

  describe "#messages" do
    let(:page_size) { 30 }

    before do
      sign_in(user)
    end

    it "errors for user when they are not allowed to chat" do
      SiteSetting.chat_allowed_groups = Group::AUTO_GROUPS[:staff]
      get "/chat/#{chat_channel.id}/messages.json", params: { page_size: page_size }
      expect(response.status).to eq(403)
    end

    it "errors when page size is over 50" do
      get "/chat/#{chat_channel.id}/messages.json", params: { page_size: 51 }
      expect(response.status).to eq(400)
    end

    it "errors when page size is nil" do
      get "/chat/#{chat_channel.id}/messages.json"
      expect(response.status).to eq(400)
    end

    it "returns the latest messages" do
      get "/chat/#{chat_channel.id}/messages.json", params: { page_size: page_size }
      messages = response.parsed_body["chat_messages"]
      expect(messages.count).to eq(page_size)
      expect(messages.first["id"]).to be < messages.last["id"]
    end

    it "returns `can_flag=true` for public channels" do
      get "/chat/#{chat_channel.id}/messages.json", params: { page_size: page_size }
      expect(response.parsed_body["meta"]["can_flag"]).to be true
    end

    it "returns `can_flag=false` for DM channels" do
      get "/chat/#{dm_chat_channel.id}/messages.json", params: { page_size: page_size }
      expect(response.parsed_body["meta"]["can_flag"]).to be false
    end

    it "serializes `user_flag_status` for user who has a pending flag" do
      chat_message = chat_channel.chat_messages.last
      chat_message.add_flag(user)
      reviewable_score = chat_message.add_flag(user)

      get "/chat/#{chat_channel.id}/messages.json", params: { page_size: page_size }
      expect(response.parsed_body["chat_messages"].last["user_flag_status"]).to eq(reviewable_score.status)
      expect(response.parsed_body["chat_messages"].second_to_last["user_flag_status"]).to be_nil
    end

    it "doesn't serialize `reviewable_ids` for non-staff" do
      chat_channel.chat_messages.last.add_flag(admin)
      chat_channel.chat_messages.second_to_last.add_flag(admin)

      get "/chat/#{chat_channel.id}/messages.json", params: { page_size: page_size }
      expect(response.parsed_body["chat_messages"].last["reviewable_id"]).to be_nil
      expect(response.parsed_body["chat_messages"].second_to_last["reviewable_id"]).to be_nil
    end

    it "serializes `reviewable_ids` correctly for staff" do
      sign_in(admin)
      last_message = chat_channel.chat_messages.last
      second_to_last_message = chat_channel.chat_messages.second_to_last

      last_reviewable = last_message.add_flag(admin)
      second_to_last_reviewable = second_to_last_message.add_flag(admin)

      get "/chat/#{chat_channel.id}/messages.json", params: { page_size: page_size }
      expect(response.parsed_body["chat_messages"].last["reviewable_id"]).to eq(last_reviewable.id)
      expect(response.parsed_body["chat_messages"].second_to_last["reviewable_id"]).to eq(second_to_last_reviewable.id)
    end

    it "correctly marks reactions as 'reacted' for the current_user" do
      heart_emoji = ":heart:"
      smile_emoji = ":smile"

      last_message = chat_channel.chat_messages.last
      last_message.reactions.create(user: user, emoji: heart_emoji)
      last_message.reactions.create(user: admin, emoji: smile_emoji)

      get "/chat/#{chat_channel.id}/messages.json", params: { page_size: page_size }
      reactions = response.parsed_body["chat_messages"].last["reactions"]
      expect(reactions[heart_emoji]["reacted"]).to be true
      expect(reactions[smile_emoji]["reacted"]).to be false
    end

    describe "with 'before_message_id' param" do
      it "returns the correct messages" do
        get "/chat/#{chat_channel.id}/messages.json", params: { before_message_id: message_40.id, page_size: page_size }
        messages = response.parsed_body["chat_messages"]
        expect(messages.count).to eq(page_size)
        expect(messages.first["id"]).to eq(chat_channel.chat_messages[40 - page_size].id)
        expect(messages.last["id"]).to eq(chat_channel.chat_messages[39].id)
      end

      it "returns 'can_load...' properly when there are more past messages" do
        get "/chat/#{chat_channel.id}/messages.json", params: { before_message_id: message_40.id, page_size: page_size }
        expect(response.parsed_body["meta"]["can_load_more_past"]).to be true
        expect(response.parsed_body["meta"]["can_load_more_future"]).to be_nil
      end

      it "returns 'can_load...' properly when there are no past messages" do
        get "/chat/#{chat_channel.id}/messages.json", params: { before_message_id: message_3.id, page_size: page_size }
        expect(response.parsed_body["meta"]["can_load_more_past"]).to be false
        expect(response.parsed_body["meta"]["can_load_more_future"]).to be_nil
      end
    end

    describe "with 'after_message_id' param" do
      it "returns the correct messages when there are many after" do
        get "/chat/#{chat_channel.id}/messages.json", params: { after_message_id: message_10.id, page_size: page_size }
        messages = response.parsed_body["chat_messages"]
        expect(messages.count).to eq(page_size)
        expect(messages.first["id"]).to eq(chat_channel.chat_messages[11].id)
        expect(messages.last["id"]).to eq(chat_channel.chat_messages[10 + page_size].id)
      end

      it "return 'can_load..' properly when there are future messages" do
        get "/chat/#{chat_channel.id}/messages.json", params: { after_message_id: message_10.id, page_size: page_size }
        expect(response.parsed_body["meta"]["can_load_more_past"]).to be_nil
        expect(response.parsed_body["meta"]["can_load_more_future"]).to be true
      end

      it "returns 'can_load..' properly when there are no future messages" do
        get "/chat/#{chat_channel.id}/messages.json", params: { after_message_id: message_60.id, page_size: page_size }
        expect(response.parsed_body["meta"]["can_load_more_past"]).to be_nil
        expect(response.parsed_body["meta"]["can_load_more_future"]).to be false
      end
    end

    it "errors when both 'after_message_id' and 'before_message_id' are present" do
      get "/chat/#{chat_channel.id}/messages.json", params: {
        before_message_id: message_40.id,
        after_message_id: message_20.id,
        page_size: page_size
      }
      expect(response.status).to eq(400)
    end

  end

  describe "#enable_chat" do
    describe "for topic" do
      it "errors for non-staff" do
        sign_in(user)
        Fabricate(:chat_channel, chatable: topic)
        post "/chat/enable.json", params: { chatable_type: "topic", chatable_id: topic.id }
        expect(response.status).to eq(403)

        expect(topic.reload.custom_fields[DiscourseChat::HAS_CHAT_ENABLED]).to be_nil
      end

      it "Returns a 422 when chat is already enabled" do
        sign_in(admin)
        Fabricate(:chat_channel, chatable: topic)
        post "/chat/enable.json", params: { chatable_type: "topic", chatable_id: topic.id }
        expect(response.status).to eq(422)

        expect(topic.reload.custom_fields[DiscourseChat::HAS_CHAT_ENABLED]).to be_nil
      end

      it "Enables chat and follows the channel" do
        sign_in(admin)
        expect {
          post "/chat/enable.json", params: { chatable_type: "topic", chatable_id: topic.id }
        }.to change {
          admin.user_chat_channel_memberships.count
        }.by(1)
        expect(response.status).to eq(200)
        expect(topic.chat_channel).to be_present
        expect(topic.reload.custom_fields[DiscourseChat::HAS_CHAT_ENABLED]).to be true
      end
    end

    describe "for tag" do
      it "enables chat" do
        sign_in(admin)
        post "/chat/enable.json", params: { chatable_type: "tag", chatable_id: tag.id }
        expect(response.status).to eq(200)
        expect(ChatChannel.where(chatable: tag)).to be_present
      end
    end
  end

  describe "#disable_chat" do
    describe "for topic" do
      it "errors for non-staff" do
        sign_in(user)
        Fabricate(:chat_channel, chatable: topic)

        post "/chat/disable.json", params: { chatable_type: "topic", chatable_id: topic.id }
        expect(response.status).to eq(403)
      end

      it "Returns a 200 and does nothing when chat is already disabled" do
        sign_in(admin)
        chat_channel = Fabricate(:chat_channel, chatable: topic)
        chat_channel.update(deleted_at: Time.now, deleted_by_id: admin.id)

        post "/chat/disable.json", params: { chatable_type: "topic", chatable_id: topic.id }
        expect(response.status).to eq(200)
        expect(chat_channel.reload.deleted_at).not_to be_nil
      end

      it "disables chat" do
        sign_in(admin)
        chat_channel = Fabricate(:chat_channel, chatable: topic)

        topic.custom_fields[DiscourseChat::HAS_CHAT_ENABLED] = true
        topic.save!

        post "/chat/disable.json", params: { chatable_type: "topic", chatable_id: topic.id }
        expect(response.status).to eq(200)
        expect(chat_channel.reload.deleted_by_id).to eq(admin.id)
        expect(topic.reload.custom_fields[DiscourseChat::HAS_CHAT_ENABLED]).to be_nil
      end
    end

    describe "for tag" do
      it "disables chat" do
        sign_in(admin)
        chat_channel = Fabricate(:chat_channel, chatable: tag)
        post "/chat/disable.json", params: { chatable_type: "tag", chatable_id: tag.id }
        expect(response.status).to eq(200)
        expect(chat_channel.reload.deleted_by_id).to eq(admin.id)
      end
    end
  end

  describe "#create_message" do
    let(:message) { "This is a message" }
    fab!(:chat_channel) { Fabricate(:chat_channel, chatable: topic) }
    fab!(:membership) { Fabricate(:user_chat_channel_membership, chat_channel: chat_channel, user: user) }

    describe "for topic" do
      before do
        sign_in(user)
      end

      it "errors for regular user when chat is staff-only" do
        SiteSetting.chat_allowed_groups = Group::AUTO_GROUPS[:staff]

        post "/chat/#{chat_channel.id}.json", params: { message: message }
        expect(response.status).to eq(403)
      end

      it "errors when the user isn't following the channel" do
        membership.destroy!
        post "/chat/#{chat_channel.id}.json", params: { message: message }
        expect(response.status).to eq(403)
      end

      it "errors when the user is not staff and the channel is not open" do
        chat_channel.update(status: ChatChannel.statuses[:closed])
        post "/chat/#{chat_channel.id}.json", params: { message: message }
        expect(response.status).to eq(422)
        expect(response.parsed_body["errors"]).to include(
          I18n.t("chat.errors.channel_new_message_disallowed", status: chat_channel.status_name)
        )
      end

      it "errors when the user is staff and the channel is not open or closed" do
        Fabricate(:user_chat_channel_membership, chat_channel: chat_channel, user: admin)
        sign_in(admin)

        chat_channel.update(status: ChatChannel.statuses[:closed])
        post "/chat/#{chat_channel.id}.json", params: { message: message }
        expect(response.status).to eq(200)

        chat_channel.update(status: ChatChannel.statuses[:read_only])
        post "/chat/#{chat_channel.id}.json", params: { message: message }
        expect(response.status).to eq(422)
        expect(response.parsed_body["errors"]).to include(
          I18n.t("chat.errors.channel_new_message_disallowed", status: chat_channel.status_name)
        )
      end

      it "sends a message for regular user when staff-only is disabled and they are following channel" do
        expect {
          post "/chat/#{chat_channel.id}.json", params: { message: message }
        }.to change { ChatMessage.count }.by(1)
        expect(response.status).to eq(200)
        expect(ChatMessage.last.message).to eq(message)
      end

      it "rate limits user properly" do
        RateLimiter.enable
        freeze_time
        post "/chat/#{chat_channel.id}.json", params: { message: message }
        expect(response.status).to eq(200)

        post "/chat/#{chat_channel.id}.json", params: { message: message }
        expect(response.status).to eq(429)
      end
    end

    describe 'for direct message' do
      fab!(:user1) { Fabricate(:user) }
      fab!(:user2) { Fabricate(:user) }
      fab!(:chatable) { Fabricate(:direct_message_channel, users: [user1, user2]) }
      fab!(:direct_message_channel) { Fabricate(:chat_channel, chatable: chatable) }

      it 'forces users to follow the channel' do
        UserChatChannelMembership.create!(user: user1, chat_channel: direct_message_channel, following: true, desktop_notification_level: UserChatChannelMembership::NOTIFICATION_LEVELS[:always], mobile_notification_level: UserChatChannelMembership::NOTIFICATION_LEVELS[:always])
        UserChatChannelMembership.create!(user: user2, chat_channel: direct_message_channel, following: false, desktop_notification_level: UserChatChannelMembership::NOTIFICATION_LEVELS[:always], mobile_notification_level: UserChatChannelMembership::NOTIFICATION_LEVELS[:always])

        expect(UserChatChannelMembership.find_by(user_id: user2.id).following).to be false

        ChatPublisher.expects(:publish_new_direct_message_channel).once

        sign_in(user1)
        post "/chat/#{direct_message_channel.id}.json", params: { message: message }

        expect(UserChatChannelMembership.find_by(user_id: user2.id).following).to be true
      end
    end
  end

  describe "#rebake" do
    fab!(:chat_channel) { Fabricate(:chat_channel) }
    fab!(:chat_message) { Fabricate(:chat_message, chat_channel: chat_channel, user: user) }

    context "staff" do
      it "rebakes the post" do
        sign_in(Fabricate(:admin))

        expect_enqueued_with(job: :process_chat_message, args: { chat_message_id: chat_message.id }) do
          put "/chat/#{chat_channel.id}/#{chat_message.id}/rebake.json"

          expect(response.status).to eq(200)
        end
      end

      context "cooked has changed" do
        it "marks the message as dirty" do
          sign_in(Fabricate(:admin))
          chat_message.update!(message: "new content")

          expect_enqueued_with(job: :process_chat_message, args: { chat_message_id: chat_message.id, is_dirty: true }) do
            put "/chat/#{chat_channel.id}/#{chat_message.id}/rebake.json"

            expect(response.status).to eq(200)
          end
        end
      end
    end

    context "not staff" do
      it "forbids non staff to rebake" do
        sign_in(Fabricate(:user))
        put "/chat/#{chat_channel.id}/#{chat_message.id}/rebake.json"
        expect(response.status).to eq(403)
      end

      context "TL3 user" do
        it "forbids less then TL4 user tries to rebake" do
          sign_in(Fabricate(:user, trust_level: TrustLevel[3]))
          put "/chat/#{chat_channel.id}/#{chat_message.id}/rebake.json"
          expect(response.status).to eq(403)
        end
      end

      context "TL4 user" do
        it "allows TL4 users to rebake" do
          sign_in(Fabricate(:user, trust_level: TrustLevel[4]))
          put "/chat/#{chat_channel.id}/#{chat_message.id}/rebake.json"
          expect(response.status).to eq(200)
        end
      end
    end
  end

  describe "#edit_message" do
    fab!(:chat_channel) { Fabricate(:chat_channel) }
    fab!(:chat_message) { Fabricate(:chat_message, chat_channel: chat_channel, user: user) }

    it "errors when a user tries to edit another user's message" do
      sign_in(Fabricate(:user))

      put "/chat/#{chat_channel.id}/edit/#{chat_message.id}.json", params: { new_message: "edit!" }
      expect(response.status).to eq(403)
    end

    it "errors when staff tries to edit another user's message" do
      sign_in(admin)
      new_message = "Vrroooom cars go fast"

      put "/chat/#{chat_channel.id}/edit/#{chat_message.id}.json", params: { new_message: new_message }
      expect(response.status).to eq(403)
    end

    it "allows a user to edit their own messages" do
      sign_in(user)
      new_message = "Wow markvanlan must be a good programmer"

      put "/chat/#{chat_channel.id}/edit/#{chat_message.id}.json", params: { new_message: new_message }
      expect(response.status).to eq(200)
      expect(chat_message.reload.message).to eq(new_message)
    end
  end

  RSpec.shared_examples "chat_message_deletion" do
    it "doesn't allow a user to delete another user's message" do
      sign_in(other_user)

      delete "/chat/#{chat_channel.id}/#{ChatMessage.last.id}.json"
      expect(response.status).to eq(403)
    end

    it "Allows admin to delete others' messages" do
      sign_in(admin)

      expect {
        delete "/chat/#{chat_channel.id}/#{ChatMessage.last.id}.json"
      }.to change { ChatMessage.count }.by(-1)
      expect(response.status).to eq(200)
    end
  end

  describe "#delete" do
    fab!(:second_user) { Fabricate(:user) }

    before do
      ChatMessage.create(user: user, message: "this is a message", chat_channel: chat_channel)
    end

    describe "for topic" do
      fab!(:chat_channel) { Fabricate(:chat_channel, chatable: topic) }

      it_behaves_like "chat_message_deletion" do
        let(:other_user) { second_user }
      end

      it "Allows users to delete their own messages" do
        sign_in(user)
        expect {
          delete "/chat/#{chat_channel.id}/#{ChatMessage.last.id}.json"
        }.to change { ChatMessage.count }.by(-1)
        expect(response.status).to eq(200)
      end
    end

    describe "for category" do
      fab!(:chat_channel) { Fabricate(:chat_channel, chatable: category) }

      it_behaves_like "chat_message_deletion" do
        let(:other_user) { second_user }
      end

      it "Allows users to delete their own messages" do
        sign_in(user)
        expect {
          delete "/chat/#{chat_channel.id}/#{ChatMessage.last.id}.json"
        }.to change { ChatMessage.count }.by(-1)
        expect(response.status).to eq(200)
      end
    end
  end

  RSpec.shared_examples "chat_message_restoration" do
    it "doesn't allow a user to restore another user's message" do
      sign_in(other_user)

      put "/chat/#{chat_channel.id}/restore/#{ChatMessage.unscoped.last.id}.json"
      expect(response.status).to eq(403)
    end

    it "allows a user to restore their own posts" do
      sign_in(user)

      deleted_message = ChatMessage.unscoped.last
      put "/chat/#{chat_channel.id}/restore/#{deleted_message.id}.json"
      expect(response.status).to eq(200)
      expect(deleted_message.reload.deleted_at).to be_nil
    end

    it "allows admin to restore others' posts" do
      sign_in(admin)

      deleted_message = ChatMessage.unscoped.last
      put "/chat/#{chat_channel.id}/restore/#{deleted_message.id}.json"
      expect(response.status).to eq(200)
      expect(deleted_message.reload.deleted_at).to be_nil
    end
  end

  describe "#restore" do
    fab!(:second_user) { Fabricate(:user) }

    before do
      message = ChatMessage.create(user: user, message: "this is a message", chat_channel: chat_channel)
      message.update(deleted_at: Time.now, deleted_by_id: user.id)
    end

    describe "for topic" do
      fab!(:chat_channel) { Fabricate(:chat_channel, chatable: topic) }

      it_behaves_like "chat_message_restoration" do
        let(:other_user) { second_user }
      end

      it "doesn't allow restoration of posts on closed topics" do
        sign_in(user)
        topic.update(closed: true)

        put "/chat/#{chat_channel.id}/restore/#{ChatMessage.unscoped.last.id}.json"
        expect(response.status).to eq(403)
      end

      it "doesn't allow restoration of posts on archived topics" do
        sign_in(user)
        topic.update(archived: true)

        put "/chat/#{chat_channel.id}/restore/#{ChatMessage.unscoped.last.id}.json"
        expect(response.status).to eq(403)
      end
    end

    describe "for category" do
      fab!(:chat_channel) { Fabricate(:chat_channel, chatable: category) }

      it_behaves_like "chat_message_restoration" do
        let(:other_user) { second_user }
      end
    end
  end

  describe "#update_user_last_read" do
    fab!(:chat_channel) { Fabricate(:chat_channel, chatable: topic) }
    fab!(:chat_message1) { Fabricate(:chat_message, chat_channel: chat_channel, user: user) }
    fab!(:chat_message2) { Fabricate(:chat_message, chat_channel: chat_channel, user: user) }

    before { sign_in(user) }

    it "updates timing records" do
      existing_record = UserChatChannelMembership.create(
        chat_channel: chat_channel,
        last_read_message_id: 0,
        user: user
      )

      expect {
        put "/chat/#{chat_channel.id}/read/#{chat_message1.id}.json"
      }.to change { UserChatChannelMembership.count }.by(0)
      existing_record.reload
      expect(existing_record.chat_channel_id).to eq(chat_channel.id)
      expect(existing_record.last_read_message_id).to eq(chat_message1.id)
      expect(existing_record.user_id).to eq(user.id)
    end

    it "marks all mention notifications as read for the channel" do
      UserChatChannelMembership.create(
        chat_channel: chat_channel,
        last_read_message_id: 0,
        user: user
      )
      notification1 = Notification.create!(
        notification_type: Notification.types[:chat_mention],
        user: user,
        high_priority: true,
        data: {
          message: 'chat.mention_notification',
          chat_message_id: chat_message1.id,
          chat_channel_id: chat_channel.id,
          chat_channel_title: chat_channel.title(user),
          mentioned_by_username: user.username,
        }.to_json
      )
      ChatMention.create(
        user: user,
        chat_message: chat_message1,
        notification: notification1
      )

      notification2 = Notification.create!(
        notification_type: Notification.types[:chat_group_mention],
        user: user,
        high_priority: true,
        data: {
          message: 'chat.mention_notification',
          chat_message_id: chat_message2.id,
          chat_channel_id: chat_channel.id,
          chat_channel_title: chat_channel.title(user),
          mentioned_by_username: user.username,
        }.to_json
      )
      ChatMention.create(
        user: user,
        chat_message: chat_message2,
        notification: notification2
      )

      put "/chat/#{chat_channel.id}/read/#{chat_message2.id}.json"
      expect(response.status).to eq(200)
      expect(notification1.reload.read).to be true
      expect(notification2.reload.read).to be true
    end
  end

  describe "react" do
    fab!(:chat_channel) { Fabricate(:chat_channel) }
    fab!(:chat_message) { Fabricate(:chat_message, chat_channel: chat_channel, user: user) }
    fab!(:user_membership) { Fabricate(:user_chat_channel_membership, chat_channel: chat_channel, user: user) }

    fab!(:private_chat_channel) { Fabricate(:chat_channel, chatable: Fabricate(:private_category, group: Fabricate(:group))) }
    fab!(:private_chat_message) { Fabricate(:chat_message, chat_channel: private_chat_channel, user: admin) }
    fab!(:priate_user_membership) { Fabricate(:user_chat_channel_membership, chat_channel: private_chat_channel, user: user) }

    fab!(:chat_channel_no_memberships) { Fabricate(:chat_channel) }
    fab!(:chat_message_no_memberships) { Fabricate(:chat_message, chat_channel: chat_channel_no_memberships, user: user) }

    it "errors with invalid emoji" do
      sign_in(user)
      put "/chat/#{chat_channel.id}/react/#{chat_message.id}.json", params: { emoji: 12, react_action: "add" }
      expect(response.status).to eq(400)
    end

    it "errors with invalid action" do
      sign_in(user)
      put "/chat/#{chat_channel.id}/react/#{chat_message.id}.json", params: { emoji: ":heart:", react_action: "sdf" }
      expect(response.status).to eq(400)
    end

    it "errors when user tries to react to channel without a membership record" do
      sign_in(user)
      put "/chat/#{chat_channel_no_memberships.id}/react/#{chat_message_no_memberships.id}.json", params: { emoji: ":heart:", react_action: "add" }
      expect(response.status).to eq(403)
    end

    it "errors when user tries to react to private channel they can't access" do
      sign_in(user)
      put "/chat/#{private_chat_channel.id}/react/#{private_chat_message.id}.json", params: { emoji: ":heart:", react_action: "add" }
      expect(response.status).to eq(403)
    end

    it "errors when the user tries to react to a read_only channel" do
      chat_channel.update(status: ChatChannel.statuses[:read_only])
      sign_in(user)
      emoji = ":heart:"
      expect {
        put "/chat/#{chat_channel.id}/react/#{chat_message.id}.json", params: { emoji: emoji, react_action: "add" }
      }.not_to change { chat_message.reactions.where(user: user, emoji: emoji).count }
      expect(response.status).to eq(403)
      expect(response.parsed_body["errors"]).to include(
        I18n.t("chat.errors.channel_modify_message_disallowed", status: chat_channel.status_name)
      )
    end

    it "adds a reaction record correctly" do
      sign_in(user)
      emoji = ":heart:"
      expect {
        put "/chat/#{chat_channel.id}/react/#{chat_message.id}.json", params: { emoji: emoji, react_action: "add" }
      }.to change { chat_message.reactions.where(user: user, emoji: emoji).count }.by(1)
      expect(response.status).to eq(200)
    end

    it "removes a reaction record correctly" do
      sign_in(user)
      emoji = ":heart:"
      chat_message.reactions.create(user: user, emoji: emoji)
      expect {
        put "/chat/#{chat_channel.id}/react/#{chat_message.id}.json", params: { emoji: emoji, react_action: "remove" }
      }.to change { chat_message.reactions.where(user: user, emoji: emoji).count }.by(-1)
      expect(response.status).to eq(200)
    end
  end

  describe "invite_users" do
    fab!(:chat_channel) { Fabricate(:chat_channel) }
    fab!(:chat_message) { Fabricate(:chat_message, chat_channel: chat_channel, user: admin) }
    fab!(:user2) { Fabricate(:user) }

    before do
      sign_in(admin)

      [user, user2].each do |u|
        u.user_option.update(chat_enabled: true)
      end
    end

    it "doesn't invite users who cannot chat" do
      SiteSetting.chat_allowed_groups = Group::AUTO_GROUPS[:admin]
      expect {
        put "/chat/#{chat_channel.id}/invite.json", params: { user_ids: [user.id] }
      }.to change { user.notifications.where(notification_type: Notification.types[:chat_invitation]).count }.by(0)
    end

    it "creates an invitation notification for users who can chat" do
      expect {
        put "/chat/#{chat_channel.id}/invite.json", params: { user_ids: [user.id] }
      }.to change { user.notifications.where(notification_type: Notification.types[:chat_invitation]).count }.by(1)
    end

    it "creates multiple invitations" do
      expect {
        put "/chat/#{chat_channel.id}/invite.json", params: { user_ids: [user.id, user2.id] }
      }.to change {
        Notification.where(notification_type: Notification.types[:chat_invitation], user_id: [user.id, user2.id]).count
      }.by(2)
    end

    it "adds chat_message_id when param is present" do
      put "/chat/#{chat_channel.id}/invite.json", params: { user_ids: [user.id], chat_message_id: chat_message.id }
      expect(JSON.parse(Notification.last.data)["chat_message_id"]).to eq(chat_message.id.to_s)
    end
  end

  describe "#dismiss_retention_reminder" do
    it "errors for anon" do
      post "/chat/dismiss-retention-reminder.json", params: { chatable_type: "Category" }
      expect(response.status).to eq(403)
    end

    it "errors when chatable_type isn't present" do
      sign_in(user)
      post "/chat/dismiss-retention-reminder.json", params: {}
      expect(response.status).to eq(400)
    end

    it "errors when chatable_type isn't a valid option" do
      sign_in(user)
      post "/chat/dismiss-retention-reminder.json", params: { chatable_type: "hi" }
      expect(response.status).to eq(400)
    end

    it "sets `dismissed_channel_retention_reminder` to true" do
      sign_in(user)
      expect {
        post "/chat/dismiss-retention-reminder.json", params: { chatable_type: "Category" }
      }.to change { user.user_option.reload.dismissed_channel_retention_reminder }.to (true)
    end

    it "sets `dismissed_dm_retention_reminder` to true" do
      sign_in(user)
      expect {
        post "/chat/dismiss-retention-reminder.json", params: { chatable_type: "DirectMessageChannel" }
      }.to change { user.user_option.reload.dismissed_dm_retention_reminder }.to (true)
    end

    it "doesn't error if the fields are already true" do
      sign_in(user)
      user.user_option.update(
        dismissed_channel_retention_reminder: true,
        dismissed_dm_retention_reminder: true
      )
      post "/chat/dismiss-retention-reminder.json", params: { chatable_type: "Category" }
      expect(response.status).to eq(200)

      post "/chat/dismiss-retention-reminder.json", params: { chatable_type: "DirectMessageChannel" }
      expect(response.status).to eq(200)
    end
  end

  describe "#quote_messages" do
    fab!(:channel) { Fabricate(:chat_channel, chatable: category, name: "Cool Chat") }
    let(:user2) { Fabricate(:user) }
    let(:message1) { Fabricate(:chat_message, user: user, chat_channel: channel, message: "an extremely insightful response :)") }
    let(:message2) { Fabricate(:chat_message, user: user2, chat_channel: channel, message: "says you!") }
    let(:message3) { Fabricate(:chat_message, user: user, chat_channel: channel, message: "aw :(") }

    it "returns a 403 if the user can't chat" do
      SiteSetting.chat_allowed_groups = nil
      sign_in(user)
      post "/chat/#{channel.id}/quote.json", params: { message_ids: [message1.id, message2.id, message3.id] }
      expect(response.status).to eq(403)
    end

    it "returns a 403 if the user can't see the channel" do
      category.update!(read_restricted: true)
      sign_in(user)
      post "/chat/#{channel.id}/quote.json", params: { message_ids: [message1.id, message2.id, message3.id] }
      expect(response.status).to eq(403)
    end

    it "returns a 403 if the channel is a DM channel" do
      sign_in(user)
      dm_channel_chatable = Fabricate(:direct_message_channel, users: [user, user2])
      dm_channel = Fabricate(:chat_channel, chatable: dm_channel_chatable)
      message1.update!(chat_channel: dm_channel)
      post "/chat/#{dm_channel.id}/quote.json", params: { message_ids: [message1.id, message2.id, message3.id] }
      expect(response.status).to eq(403)
    end

    it "returns a 404 for a not found channel" do
      channel.destroy
      sign_in(user)
      post "/chat/#{channel.id}/quote.json", params: { message_ids: [message1.id, message2.id, message3.id] }
      expect(response.status).to eq(404)
    end

    it "quotes the message ids provided" do
      sign_in(user)
      post "/chat/#{channel.id}/quote.json", params: { message_ids: [message1.id, message2.id, message3.id] }
      expect(response.status).to eq(200)
      markdown = response.parsed_body["markdown"]
      expect(markdown).to eq(<<~EXPECTED)
      [chat quote="#{user.username};#{message1.id};#{message1.created_at.iso8601}" channel="Cool Chat" multiQuote="true" chained="true"]
      an extremely insightful response :)
      [/chat]

      [chat quote="#{user2.username};#{message2.id};#{message2.created_at.iso8601}" chained="true"]
      says you!
      [/chat]

      [chat quote="#{user.username};#{message3.id};#{message3.created_at.iso8601}" chained="true"]
      aw :(
      [/chat]
      EXPECTED
    end
  end

  describe "#flag" do
    fab!(:admin_chat_message) { Fabricate(:chat_message, user: admin, chat_channel: chat_channel) }
    fab!(:user_chat_message) { Fabricate(:chat_message, user: user, chat_channel: chat_channel) }

    fab!(:admin_dm_message) { Fabricate(:chat_message, user: admin, chat_channel: dm_chat_channel) }

    before do
      sign_in(user)
    end

    it "creates reviewable" do
      expect {
        put "/chat/flag.json", params: { chat_message_id: admin_chat_message.id }
      }.to change { ReviewableChatMessage.where(target: admin_chat_message).count }.by(1)
      expect(response.status).to eq(200)
    end

    it "doesn't allow flagging your own message" do
      put "/chat/flag.json", params: { chat_message_id: user_chat_message.id }
      expect(response.status).to eq(403)
    end

    it "doesn't allow flagging staff if SiteSetting.allow_flagging_staff is false" do
      SiteSetting.allow_flagging_staff = false
      put "/chat/flag.json", params: { chat_message_id: admin_chat_message.id }
      expect(response.status).to eq(403)
    end

    it "doesn't allow flagging direct messages" do
      put "/chat/flag.json", params: { chat_message_id: admin_dm_message.id }
      expect(response.status).to eq(403)
    end
  end

  describe "#set_draft" do
    fab!(:chat_channel) { Fabricate(:chat_channel) }

    it "can create and destroy chat drafts" do
      sign_in(user)

      expect { post "/chat/drafts.json", params: { channel_id: chat_channel.id, data: "{}" } }
        .to change { ChatDraft.count }.by(1)

      expect { post "/chat/drafts.json", params: { channel_id: chat_channel.id } }
        .to change { ChatDraft.count }.by(-1)
    end
  end
end
