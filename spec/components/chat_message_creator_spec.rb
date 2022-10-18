# frozen_string_literal: true

require "rails_helper"

describe DiscourseChat::ChatMessageCreator do
  fab!(:admin1) { Fabricate(:admin) }
  fab!(:admin2) { Fabricate(:admin) }
  fab!(:user1) { Fabricate(:user, group_ids: [Group::AUTO_GROUPS[:everyone]]) }
  fab!(:user2) { Fabricate(:user) }
  fab!(:user3) { Fabricate(:user) }
  fab!(:user4) { Fabricate(:user) }
  fab!(:admin_group) do
    Fabricate(
      :public_group,
      users: [admin1, admin2],
      mentionable_level: Group::ALIAS_LEVELS[:everyone],
    )
  end
  fab!(:user_group) do
    Fabricate(
      :public_group,
      users: [user1, user2, user3],
      mentionable_level: Group::ALIAS_LEVELS[:everyone],
    )
  end
  fab!(:user_without_memberships) { Fabricate(:user) }
  fab!(:public_chat_channel) { Fabricate(:chat_channel, chatable: Fabricate(:topic)) }
  fab!(:dm_chat_channel) do
    Fabricate(
      :chat_channel,
      chatable: Fabricate(:direct_message_channel, users: [user1, user2, user3]),
    )
  end

  before do
    SiteSetting.chat_enabled = true
    SiteSetting.chat_allowed_groups = Group::AUTO_GROUPS[:everyone]
    SiteSetting.chat_duplicate_message_sensitivity = 0

    # Create channel memberships
    [admin1, admin2, user1, user2, user3].each do |user|
      Fabricate(:user_chat_channel_membership, chat_channel: public_chat_channel, user: user)
    end

    Group.refresh_automatic_groups!
    @direct_message_channel =
      DiscourseChat::DirectMessageChannelCreator.create!(
        acting_user: user1,
        target_users: [user1, user2],
      )
  end

  describe "Integration tests with jobs running immediately" do
    before { Jobs.run_immediately! }

    it "errors when length is less than `chat_minimum_message_length`" do
      SiteSetting.chat_minimum_message_length = 10
      creator =
        DiscourseChat::ChatMessageCreator.create(
          chat_channel: public_chat_channel,
          user: user1,
          content: "2 short",
        )
      expect(creator.failed?).to eq(true)
      expect(creator.error.message).to match(
        I18n.t(
          "chat.errors.minimum_length_not_met",
          { minimum: SiteSetting.chat_minimum_message_length },
        ),
      )
    end

    it "allows message creation when length is less than `chat_minimum_message_length` when upload is present" do
      upload = Fabricate(:upload, user: user1)
      SiteSetting.chat_minimum_message_length = 10
      expect {
        DiscourseChat::ChatMessageCreator.create(
          chat_channel: public_chat_channel,
          user: user1,
          content: "2 short",
          upload_ids: [upload.id],
        )
      }.to change { ChatMessage.count }.by(1)
    end

    it "creates messages for users who can see the channel" do
      expect {
        DiscourseChat::ChatMessageCreator.create(
          chat_channel: public_chat_channel,
          user: user1,
          content: "this is a message",
        )
      }.to change { ChatMessage.count }.by(1)
    end

    it "creates mention notifications for public chat" do
      expect {
        DiscourseChat::ChatMessageCreator.create(
          chat_channel: public_chat_channel,
          user: user1,
          content:
            "this is a @#{user1.username} message with @system @mentions @#{user2.username} and @#{user3.username}",
        )
        # Only 2 mentions are created because user mentioned themselves, system, and an invalid username.
      }.to change { ChatMention.count }.by(2).and not_change { user1.chat_mentions.count }
    end

    it "mentions are case insensitive" do
      expect {
        DiscourseChat::ChatMessageCreator.create(
          chat_channel: public_chat_channel,
          user: user1,
          content: "Hey @#{user2.username.upcase}",
        )
      }.to change { user2.chat_mentions.count }.by(1)
    end

    it "notifies @all properly" do
      expect {
        DiscourseChat::ChatMessageCreator.create(
          chat_channel: public_chat_channel,
          user: user1,
          content: "@all",
        )
      }.to change { ChatMention.count }.by(4)

      UserChatChannelMembership.where(user: user2, chat_channel: public_chat_channel).update_all(
        following: false,
      )
      expect {
        DiscourseChat::ChatMessageCreator.create(
          chat_channel: public_chat_channel,
          user: user1,
          content: "again! @all",
        )
      }.to change { ChatMention.count }.by(3)
    end

    it "notifies @here properly" do
      admin1.update(last_seen_at: 1.year.ago)
      admin2.update(last_seen_at: 1.year.ago)
      user1.update(last_seen_at: Time.now)
      user2.update(last_seen_at: Time.now)
      user3.update(last_seen_at: Time.now)
      expect {
        DiscourseChat::ChatMessageCreator.create(
          chat_channel: public_chat_channel,
          user: user1,
          content: "@here",
        )
      }.to change { ChatMention.count }.by(2)
    end

    it "doesn't sent double notifications when '@here' is mentioned" do
      user2.update(last_seen_at: Time.now)
      expect {
        DiscourseChat::ChatMessageCreator.create(
          chat_channel: public_chat_channel,
          user: user1,
          content: "@here @#{user2.username}",
        )
      }.to change { user2.chat_mentions.count }.by(1)
    end

    it "notifies @here plus other mentions" do
      admin1.update(last_seen_at: Time.now)
      admin2.update(last_seen_at: 1.year.ago)
      user1.update(last_seen_at: 1.year.ago)
      user2.update(last_seen_at: 1.year.ago)
      user3.update(last_seen_at: 1.year.ago)
      expect {
        DiscourseChat::ChatMessageCreator.create(
          chat_channel: public_chat_channel,
          user: user1,
          content: "@here plus @#{user3.username}",
        )
      }.to change { user3.chat_mentions.count }.by(1)
    end

    it "doesn't create mention notifications for users without a membership record" do
      expect {
        DiscourseChat::ChatMessageCreator.create(
          chat_channel: public_chat_channel,
          user: user1,
          content: "hello @#{user_without_memberships.username}",
        )
      }.not_to change { ChatMention.count }
    end

    it "doesn't create mention notifications for users who cannot chat" do
      new_group = Group.create
      SiteSetting.chat_allowed_groups = new_group.id
      expect {
        DiscourseChat::ChatMessageCreator.create(
          chat_channel: public_chat_channel,
          user: user1,
          content: "hi @#{user2.username} @#{user3.username}",
        )
      }.not_to change { ChatMention.count }
    end

    it "doesn't create mention notifications for users with chat disabled" do
      user2.user_option.update(chat_enabled: false)
      expect {
        DiscourseChat::ChatMessageCreator.create(
          chat_channel: public_chat_channel,
          user: user1,
          content: "hi @#{user2.username}",
        )
      }.not_to change { ChatMention.count }
    end

    it "creates only mention notifications for users with access in private chat" do
      expect {
        DiscourseChat::ChatMessageCreator.create(
          chat_channel: @direct_message_channel,
          user: user1,
          content: "hello there @#{user2.username} and @#{user3.username}",
        )
        # Only user2 should be notified
      }.to change { user2.chat_mentions.count }.by(1).and not_change { user3.chat_mentions.count }
    end

    it "creates a mention notifications for group users that are participating in private chat" do
      expect {
        DiscourseChat::ChatMessageCreator.create(
          chat_channel: @direct_message_channel,
          user: user1,
          content: "hello there @#{user_group.name}",
        )
        # Only user2 should be notified
      }.to change { user2.chat_mentions.count }.by(1).and not_change { user3.chat_mentions.count }
    end

    it "publishes inaccessible mentions when user isn't aren't a part of the channel" do
      ChatPublisher.expects(:publish_inaccessible_mentions).once
      DiscourseChat::ChatMessageCreator.create(
        chat_channel: public_chat_channel,
        user: admin1,
        content: "hello @#{user4.username}",
      )
    end

    it "publishes inaccessible mentions when user doesn't have chat access" do
      SiteSetting.chat_allowed_groups = Group::AUTO_GROUPS[:staff]
      ChatPublisher.expects(:publish_inaccessible_mentions).once
      DiscourseChat::ChatMessageCreator.create(
        chat_channel: public_chat_channel,
        user: admin1,
        content: "hello @#{user3.username}",
      )
    end

    it "doesn't publish inaccessible mentions when user is following channel" do
      ChatPublisher.expects(:publish_inaccessible_mentions).never
      DiscourseChat::ChatMessageCreator.create(
        chat_channel: public_chat_channel,
        user: admin1,
        content: "hello @#{admin2.username}",
      )
    end

    it "does not create mentions for suspended users" do
      user2.update(suspended_till: Time.now + 10.years)
      expect {
        DiscourseChat::ChatMessageCreator.create(
          chat_channel: @direct_message_channel,
          user: user1,
          content: "hello @#{user2.username}",
        )
      }.not_to change { user2.chat_mentions.count }
    end

    it "does not create @all mentions for users when ignore_channel_wide_mention is enabled" do
      expect {
        DiscourseChat::ChatMessageCreator.create(
          chat_channel: public_chat_channel,
          user: user1,
          content: "@all",
        )
      }.to change { ChatMention.count }.by(4)

      user2.user_option.update(ignore_channel_wide_mention: true)
      expect {
        DiscourseChat::ChatMessageCreator.create(
          chat_channel: public_chat_channel,
          user: user1,
          content: "hi! @all",
        )
      }.to change { ChatMention.count }.by(3)
    end

    it "does not create @here mentions for users when ignore_channel_wide_mention is enabled" do
      admin1.update(last_seen_at: 1.year.ago)
      admin2.update(last_seen_at: 1.year.ago)
      user1.update(last_seen_at: Time.now)
      user2.update(last_seen_at: Time.now)
      user2.user_option.update(ignore_channel_wide_mention: true)
      user3.update(last_seen_at: Time.now)

      expect {
        DiscourseChat::ChatMessageCreator.create(
          chat_channel: public_chat_channel,
          user: user1,
          content: "@here",
        )
      }.to change { ChatMention.count }.by(1)
    end

    describe "group mentions" do
      it "creates chat mentions for group mentions where the group is mentionable" do
        expect {
          DiscourseChat::ChatMessageCreator.create(
            chat_channel: public_chat_channel,
            user: user1,
            content: "hello @#{admin_group.name}",
          )
        }.to change { admin1.chat_mentions.count }.by(1).and change {
                admin2.chat_mentions.count
              }.by(1)
      end

      it "doesn't mention users twice if they are direct mentioned and group mentioned" do
        expect {
          DiscourseChat::ChatMessageCreator.create(
            chat_channel: public_chat_channel,
            user: user1,
            content: "hello @#{admin_group.name} @#{admin1.username} and @#{admin2.username}",
          )
        }.to change { admin1.chat_mentions.count }.by(1).and change {
                admin2.chat_mentions.count
              }.by(1)
      end

      it "creates chat mentions for group mentions and direct mentions" do
        expect {
          DiscourseChat::ChatMessageCreator.create(
            chat_channel: public_chat_channel,
            user: user1,
            content: "hello @#{admin_group.name} @#{user2.username}",
          )
        }.to change { admin1.chat_mentions.count }.by(1).and change {
                admin2.chat_mentions.count
              }.by(1).and change { user2.chat_mentions.count }.by(1)
      end

      it "creates chat mentions for group mentions and direct mentions" do
        expect {
          DiscourseChat::ChatMessageCreator.create(
            chat_channel: public_chat_channel,
            user: user1,
            content: "hello @#{admin_group.name} @#{user_group.name}",
          )
        }.to change { admin1.chat_mentions.count }.by(1).and change {
                admin2.chat_mentions.count
              }.by(1).and change { user2.chat_mentions.count }.by(1).and change {
                            user3.chat_mentions.count
                          }.by(1)
      end

      it "doesn't create chat mentions for group mentions where the group is un-mentionable" do
        admin_group.update(mentionable_level: Group::ALIAS_LEVELS[:nobody])
        expect {
          DiscourseChat::ChatMessageCreator.create(
            chat_channel: public_chat_channel,
            user: user1,
            content: "hello @#{admin_group.name}",
          )
        }.not_to change { ChatMention.count }
      end
    end

    describe "push notifications" do
      before do
        UserChatChannelMembership.where(user: user1, chat_channel: public_chat_channel).update(
          mobile_notification_level: UserChatChannelMembership::NOTIFICATION_LEVELS[:always],
        )
        PresenceChannel.clear_all!
      end

      it "sends a push notification to watching users who are not in chat" do
        PostAlerter.expects(:push_notification).once
        DiscourseChat::ChatMessageCreator.create(
          chat_channel: public_chat_channel,
          user: user2,
          content: "Beep boop",
        )
      end

      it "does not send a push notification to watching users who are in chat" do
        PresenceChannel.new("/chat/online").present(user_id: user1.id, client_id: 1)
        PostAlerter.expects(:push_notification).never
        DiscourseChat::ChatMessageCreator.create(
          chat_channel: public_chat_channel,
          user: user2,
          content: "Beep boop",
        )
      end
    end

    describe "with uploads" do
      fab!(:upload1) { Fabricate(:upload, user: user1) }
      fab!(:upload2) { Fabricate(:upload, user: user1) }
      fab!(:private_upload) { Fabricate(:upload, user: user2) }

      it "can attach 1 upload to a new message" do
        expect {
          DiscourseChat::ChatMessageCreator.create(
            chat_channel: public_chat_channel,
            user: user1,
            content: "Beep boop",
            upload_ids: [upload1.id],
          )
        }.to change { ChatUpload.where(upload_id: upload1.id).count }.by(1)
      end

      it "can attach multiple uploads to a new message" do
        expect {
          DiscourseChat::ChatMessageCreator.create(
            chat_channel: public_chat_channel,
            user: user1,
            content: "Beep boop",
            upload_ids: [upload1.id, upload2.id],
          )
        }.to change { ChatUpload.where(upload_id: upload1.id).count }.by(1).and change {
                ChatUpload.where(upload_id: upload2.id).count
              }.by(1)
      end

      it "filters out uploads that weren't uploaded by the user" do
        expect {
          DiscourseChat::ChatMessageCreator.create(
            chat_channel: public_chat_channel,
            user: user1,
            content: "Beep boop",
            upload_ids: [private_upload.id],
          )
        }.not_to change { ChatUpload.where(upload_id: private_upload.id).count }
      end

      it "doesn't attach uploads when `chat_allow_uploads` is false" do
        SiteSetting.chat_allow_uploads = false
        expect {
          DiscourseChat::ChatMessageCreator.create(
            chat_channel: public_chat_channel,
            user: user1,
            content: "Beep boop",
            upload_ids: [upload1.id],
          )
        }.not_to change { ChatUpload.where(upload_id: upload1.id).count }
      end
    end
  end

  it "destroys draft after message was created" do
    ChatDraft.create!(user: user1, chat_channel: public_chat_channel, data: "{}")

    expect do
      DiscourseChat::ChatMessageCreator.create(
        chat_channel: public_chat_channel,
        user: user1,
        content: "Hi @#{user2.username}",
      )
    end.to change { ChatDraft.count }.by(-1)
  end

  describe "watched words" do
    fab!(:watched_word) { Fabricate(:watched_word) }

    it "errors when a blocked word is present" do
      creator =
        DiscourseChat::ChatMessageCreator.create(
          chat_channel: public_chat_channel,
          user: user1,
          content: "bad word - #{watched_word.word}",
        )
      expect(creator.failed?).to eq(true)
      expect(creator.error.message).to match(
        I18n.t("contains_blocked_word", { word: watched_word.word }),
      )
    end
  end

  describe "channel statuses" do
    def create_message(user)
      DiscourseChat::ChatMessageCreator.create(
        chat_channel: public_chat_channel,
        user: user,
        content: "test message",
      )
    end

    context "when channel is closed" do
      before { public_chat_channel.update(status: :closed) }

      it "errors when trying to create the message for non-staff" do
        creator = create_message(user1)
        expect(creator.failed?).to eq(true)
        expect(creator.error.message).to eq(
          I18n.t(
            "chat.errors.channel_new_message_disallowed",
            status: public_chat_channel.status_name,
          ),
        )
      end

      it "does not error when trying to create a message for staff" do
        expect { create_message(admin1) }.to change { ChatMessage.count }.by(1)
      end
    end

    context "when channel is read_only" do
      before { public_chat_channel.update(status: :read_only) }

      it "errors when trying to create the message for all users" do
        creator = create_message(user1)
        expect(creator.failed?).to eq(true)
        expect(creator.error.message).to eq(
          I18n.t(
            "chat.errors.channel_new_message_disallowed",
            status: public_chat_channel.status_name,
          ),
        )
        creator = create_message(admin1)
        expect(creator.failed?).to eq(true)
        expect(creator.error.message).to eq(
          I18n.t(
            "chat.errors.channel_new_message_disallowed",
            status: public_chat_channel.status_name,
          ),
        )
      end
    end

    context "when channel is archived" do
      before { public_chat_channel.update(status: :archived) }

      it "errors when trying to create the message for all users" do
        creator = create_message(user1)
        expect(creator.failed?).to eq(true)
        expect(creator.error.message).to eq(
          I18n.t(
            "chat.errors.channel_new_message_disallowed",
            status: public_chat_channel.status_name,
          ),
        )
        creator = create_message(admin1)
        expect(creator.failed?).to eq(true)
        expect(creator.error.message).to eq(
          I18n.t(
            "chat.errors.channel_new_message_disallowed",
            status: public_chat_channel.status_name,
          ),
        )
      end
    end
  end
end
