# frozen_string_literal: true

require 'rails_helper'

describe DiscourseChat::ChatMessageUpdater do
  fab!(:admin1) { Fabricate(:admin) }
  fab!(:admin2) { Fabricate(:admin) }
  fab!(:user1) { Fabricate(:user) }
  fab!(:user2) { Fabricate(:user) }
  fab!(:user3) { Fabricate(:user) }
  fab!(:user4) { Fabricate(:user) }
  fab!(:admin_group) { Fabricate(:public_group, users: [admin1, admin2], mentionable_level: Group::ALIAS_LEVELS[:everyone]) }
  fab!(:user_without_memberships) { Fabricate(:user) }
  fab!(:public_chat_channel) { Fabricate(:chat_channel, chatable: Fabricate(:topic)) }

  before do
    SiteSetting.chat_enabled = true
    SiteSetting.chat_allowed_groups = Group::AUTO_GROUPS[:everyone]
    SiteSetting.chat_duplicate_message_sensitivity = 0
    Jobs.run_immediately!

    [admin1, admin2, user1, user2, user3, user4].each do |user|
      Fabricate(:user_chat_channel_membership, chat_channel: public_chat_channel, user: user)
    end
    @direct_message_channel = DiscourseChat::DirectMessageChannelCreator.create!(target_users: [user1, user2])
  end

  def create_chat_message(user, message, channel, upload_ids: nil)
    creator = DiscourseChat::ChatMessageCreator.create(
      chat_channel: channel,
      user: user,
      in_reply_to_id: nil,
      content: message,
      upload_ids: upload_ids
    )
    creator.chat_message
  end

  it "errors when length is less than `chat_minimum_message_length`" do
    SiteSetting.chat_minimum_message_length = 10
    og_message = "This won't be changed!"
    chat_message = create_chat_message(user1, og_message, public_chat_channel)
    new_message = "2 short"

    updater = DiscourseChat::ChatMessageUpdater.update(
      chat_message: chat_message,
      new_content: new_message
    )
    expect(updater.failed?).to eq(true)
    expect(updater.error.message).to match(I18n.t("chat.errors.minimum_length_not_met", { minimum: SiteSetting.chat_minimum_message_length }))
    expect(chat_message.reload.message).to eq(og_message)
  end

  it "it updates a messages content" do
    chat_message = create_chat_message(user1, "This will be changed", public_chat_channel)
    new_message = "Change to this!"

    DiscourseChat::ChatMessageUpdater.update(
      chat_message: chat_message,
      new_content: new_message
    )
    expect(chat_message.reload.message).to eq(new_message)
  end

  it "creates mention notifications for unmentioned users" do
    chat_message = create_chat_message(user1, "This will be changed", public_chat_channel)
    expect {
      DiscourseChat::ChatMessageUpdater.update(
        chat_message: chat_message,
        new_content: "this is a message with @system @mentions @#{user2.username} and @#{user3.username}"
      )
    }.to change { user2.chat_mentions.count }.by(1)
      .and change {
        user3.chat_mentions.count
      }.by(1)
  end

  it "doesn't create mentions for already mentioned users" do
    message = "ping @#{user2.username} @#{user3.username}"
    chat_message = create_chat_message(user1, message, public_chat_channel)
    expect {
      DiscourseChat::ChatMessageUpdater.update(
        chat_message: chat_message,
        new_content: message + " editedddd"
      )
    }.to change { ChatMention.count }.by(0)
  end

  it "doesn't create mentions for users without access" do
    message = "ping"
    chat_message = create_chat_message(user1, message, public_chat_channel)

    expect {
      DiscourseChat::ChatMessageUpdater.update(
        chat_message: chat_message,
        new_content: message + " @#{user_without_memberships.username}"
      )
    }.to change { ChatMention.count }.by(0)
  end

  it "destroys mention notifications that should be removed" do
    chat_message = create_chat_message(user1, "ping @#{user2.username} @#{user3.username}", public_chat_channel)
    expect {
      DiscourseChat::ChatMessageUpdater.update(
        chat_message: chat_message,
        new_content: "ping @#{user3.username}"
      )
    }.to change { user2.chat_mentions.count }.by(-1)
      .and change {
        user3.chat_mentions.count
      }.by(0)
  end

  it "creates new, leaves existing, and removes old mentions all at once" do
    chat_message = create_chat_message(user1, "ping @#{user2.username} @#{user3.username}", public_chat_channel)
    DiscourseChat::ChatMessageUpdater.update(
      chat_message: chat_message,
      new_content: "ping @#{user3.username} @#{user4.username}"
    )

    expect(user2.chat_mentions.where(chat_message: chat_message)).not_to be_present
    expect(user3.chat_mentions.where(chat_message: chat_message)).to be_present
    expect(user4.chat_mentions.where(chat_message: chat_message)).to be_present
  end

  it "does not create new mentions in direct message for users who don't have access" do
    chat_message = create_chat_message(user1, "ping nobody" , @direct_message_channel)
    expect {
      DiscourseChat::ChatMessageUpdater.update(
        chat_message: chat_message,
        new_content: "ping @#{admin1.username}"
      )
    }.to change { ChatMention.count }.by(0)
  end

  describe "group mentions" do
    it "creates group mentions on update" do
      chat_message = create_chat_message(user1, "ping nobody", public_chat_channel)
      expect {
        DiscourseChat::ChatMessageUpdater.update(
          chat_message: chat_message,
          new_content: "ping @#{admin_group.name}"
        )
      }.to change { ChatMention.where(chat_message: chat_message).count }.by(2)

      expect(admin1.chat_mentions.where(chat_message: chat_message)).to be_present
      expect(admin2.chat_mentions.where(chat_message: chat_message)).to be_present
    end

    it "doesn't duplicate mentions when the user is already direct mentioned and then group mentioned" do
      chat_message = create_chat_message(user1, "ping @#{admin2.username}", public_chat_channel)
      expect {
        DiscourseChat::ChatMessageUpdater.update(
          chat_message: chat_message,
          new_content: "ping @#{admin_group.name} @#{admin2.username}"
        )
      }.to change { admin1.chat_mentions.count }.by(1)
        .and change {
          admin2.chat_mentions.count
        }.by(0)
    end

    it "deletes old mentions when group mention is removed" do
      chat_message = create_chat_message(user1, "ping @#{admin_group.name}", public_chat_channel)
      expect {
        DiscourseChat::ChatMessageUpdater.update(
          chat_message: chat_message,
          new_content: "ping nobody anymore!"
        )
      }.to change { ChatMention.where(chat_message: chat_message).count }.by(-2)

      expect(admin1.chat_mentions.where(chat_message: chat_message)).not_to be_present
      expect(admin2.chat_mentions.where(chat_message: chat_message)).not_to be_present
    end
  end

  it "creates a chat_message_revision record" do
    old_message = "It's a thrsday!"
    new_message = "It's a thursday!"
    chat_message = create_chat_message(user1, old_message, public_chat_channel)
    DiscourseChat::ChatMessageUpdater.update(
      chat_message: chat_message,
      new_content: new_message
    )
    revision = chat_message.revisions.last
    expect(revision.old_message).to eq(old_message)
    expect(revision.new_message).to eq(new_message)
  end

  describe "uploads" do
    fab!(:upload1) { Fabricate(:upload, user: user1) }
    fab!(:upload2) { Fabricate(:upload, user: user1) }

    it "does nothing if the passed in upload_ids match the existing upload_ids" do
      chat_message = create_chat_message(user1, "something", public_chat_channel, upload_ids: [upload1.id, upload2.id])
      expect {
        DiscourseChat::ChatMessageUpdater.update(
          chat_message: chat_message,
          new_content: "I guess this is different",
          upload_ids: [upload2.id, upload1.id]
        )
      }.to change { ChatUpload.count }.by(0)
    end

    it "removes uploads that should be removed" do
      chat_message = create_chat_message(user1, "something", public_chat_channel, upload_ids: [upload1.id, upload2.id])
      expect {
        DiscourseChat::ChatMessageUpdater.update(
          chat_message: chat_message,
          new_content: "I guess this is different",
          upload_ids: [upload1.id]
        )
      }.to change { ChatUpload.where(upload_id: upload2.id).count }.by(-1)
    end

    it "removes all uploads if they should be removed" do
      chat_message = create_chat_message(user1, "something", public_chat_channel, upload_ids: [upload1.id, upload2.id])
      expect {
        DiscourseChat::ChatMessageUpdater.update(
          chat_message: chat_message,
          new_content: "I guess this is different",
          upload_ids: []
        )
      }.to change { ChatUpload.where(chat_message: chat_message).count }.by(-2)
    end

    it "adds one upload if none exist" do
      chat_message = create_chat_message(user1, "something", public_chat_channel)
      expect {
        DiscourseChat::ChatMessageUpdater.update(
          chat_message: chat_message,
          new_content: "I guess this is different",
          upload_ids: [upload1.id]
        )
      }.to change { ChatUpload.where(chat_message: chat_message).count }.by(1)
    end

    it "adds multiple uploads if none exist" do
      chat_message = create_chat_message(user1, "something", public_chat_channel)
      expect {
        DiscourseChat::ChatMessageUpdater.update(
          chat_message: chat_message,
          new_content: "I guess this is different",
          upload_ids: [upload1.id, upload2.id]
        )
      }.to change { ChatUpload.where(chat_message: chat_message).count }.by(2)
    end

    it "doesn't remove existing uploads when BS upload ids are passed in" do
      chat_message = create_chat_message(user1, "something", public_chat_channel, upload_ids: [upload1.id])
      expect {
        DiscourseChat::ChatMessageUpdater.update(
          chat_message: chat_message,
          new_content: "I guess this is different",
          upload_ids: [0]
        )
      }.to change { ChatUpload.where(chat_message: chat_message).count }.by(0)
    end

    it "doesn't add uploads if `chat_allow_uploads` is false" do
      SiteSetting.chat_allow_uploads = false
      chat_message = create_chat_message(user1, "something", public_chat_channel)
      expect {
        DiscourseChat::ChatMessageUpdater.update(
          chat_message: chat_message,
          new_content: "I guess this is different",
          upload_ids: [upload1.id, upload2.id]
        )
      }.to change { ChatUpload.where(chat_message: chat_message).count }.by(0)
    end

    it "doesn't remove existing uploads if `chat_allow_uploads` is false" do
      SiteSetting.chat_allow_uploads = false
      chat_message = create_chat_message(user1, "something", public_chat_channel, upload_ids: [upload1.id, upload2.id])
      expect {
        DiscourseChat::ChatMessageUpdater.update(
          chat_message: chat_message,
          new_content: "I guess this is different",
          upload_ids: []
        )
      }.to change { ChatUpload.where(chat_message: chat_message).count }.by(0)
    end

    it "updates if upload is present even if length is less than `chat_minimum_message_length`" do
      chat_message = create_chat_message(user1, "something", public_chat_channel, upload_ids: [upload1.id, upload2.id])
      SiteSetting.chat_minimum_message_length = 10
      new_message = "hi :)"
      DiscourseChat::ChatMessageUpdater.update(
        chat_message: chat_message,
        new_content: new_message,
        upload_ids: [upload1.id]
      )
      expect(chat_message.reload.message).to eq(new_message)
    end
  end

  describe "watched words" do
    fab!(:watched_word) { Fabricate(:watched_word) }

    it "errors when a blocked word is present" do
      chat_message = create_chat_message(user1, "something", public_chat_channel)
      creator = DiscourseChat::ChatMessageCreator.create(
        chat_channel: public_chat_channel,
        user: user1,
        content: "bad word - #{watched_word.word}"
      )
      expect(creator.failed?).to eq(true)
      expect(creator.error.message).to match(I18n.t("contains_blocked_word", { word: watched_word.word }))
    end
  end

  describe "channel statuses" do
    fab!(:message) { Fabricate(:chat_message, user: user1, chat_channel: public_chat_channel) }

    def update_message(user)
      message.update(user: user)
      DiscourseChat::ChatMessageUpdater.update(
        chat_message: message,
        new_content: "I guess this is different"
      )
    end

    context "when channel is closed" do
      before do
        public_chat_channel.update(status: :closed)
      end

      it "errors when trying to update the message for non-staff" do
        updater = update_message(user1)
        expect(updater.failed?).to eq(true)
        expect(updater.error.message).to eq(
          I18n.t("chat.errors.channel_modify_message_disallowed", status: public_chat_channel.status_name)
        )
      end

      it "does not error when trying to create a message for staff" do
        update_message(admin1)
        expect(message.reload.message).to eq("I guess this is different")
      end
    end

    context "when channel is read_only" do
      before do
        public_chat_channel.update(status: :read_only)
      end

      it "errors when trying to update the message for all users" do
        updater = update_message(user1)
        expect(updater.failed?).to eq(true)
        expect(updater.error.message).to eq(
          I18n.t("chat.errors.channel_modify_message_disallowed", status: public_chat_channel.status_name)
        )
        updater = update_message(admin1)
        expect(updater.failed?).to eq(true)
        expect(updater.error.message).to eq(
          I18n.t("chat.errors.channel_modify_message_disallowed", status: public_chat_channel.status_name)
        )
      end
    end

    context "when channel is archived" do
      before do
        public_chat_channel.update(status: :archived)
      end

      it "errors when trying to update the message for all users" do
        updater = update_message(user1)
        expect(updater.failed?).to eq(true)
        expect(updater.error.message).to eq(
          I18n.t("chat.errors.channel_modify_message_disallowed", status: public_chat_channel.status_name)
        )
        updater = update_message(admin1)
        expect(updater.failed?).to eq(true)
        expect(updater.error.message).to eq(
          I18n.t("chat.errors.channel_modify_message_disallowed", status: public_chat_channel.status_name)
        )
      end
    end
  end
end
