# frozen_string_literal: true

require 'rails_helper'

describe ChatMessageBookmarkable do
  fab!(:user) { Fabricate(:user) }
  fab!(:guardian) { Guardian.new(user) }
  fab!(:topic) { Fabricate(:topic) }
  fab!(:other_category) { Fabricate(:private_category, group: Fabricate(:group)) }
  fab!(:channel) { Fabricate(:chat_channel, chatable: topic) }
  fab!(:category_channel) { Fabricate(:chat_channel, chatable: other_category) }
  fab!(:private_category) { Fabricate(:private_category, group: Fabricate(:group)) }

  before do
    Bookmark.register_bookmarkable(ChatMessageBookmarkable)
    UserChatChannelMembership.create(chat_channel: channel, user: user, following: true)
  end

  let!(:message1) { Fabricate(:chat_message, chat_channel: channel) }
  let!(:message2) { Fabricate(:chat_message, chat_channel: channel) }
  let!(:bookmark1) { Fabricate(:bookmark, user: user, bookmarkable: message1, name: "something i gotta do") }
  let!(:bookmark2) { Fabricate(:bookmark, user: user, bookmarkable: message2) }
  let!(:bookmark3) { Fabricate(:bookmark) }

  subject { RegisteredBookmarkable.new(ChatMessageBookmarkable) }

  describe "#perform_list_query" do
    it "returns all the user's bookmarks" do
      expect(subject.perform_list_query(user, guardian).map(&:id)).to match_array([bookmark1.id, bookmark2.id])
    end

    it "does not return bookmarks for messages inside topic chat channels the user cannot access" do
      bookmark1.bookmarkable.chat_channel.chatable.update(category: private_category)
      expect(subject.perform_list_query(user, guardian)).to eq(nil)
      private_category.groups.last.add(user)
      bookmark1.reload
      user.reload
      guardian = Guardian.new(user)
      expect(subject.perform_list_query(user, guardian).map(&:id)).to match_array([bookmark1.id, bookmark2.id])
    end

    it "does not return bookmarks for messages inside category chat channels the user cannot access" do
      channel.update(chatable: other_category)
      expect(subject.perform_list_query(user, guardian)).to eq(nil)
      other_category.groups.last.add(user)
      bookmark1.reload
      user.reload
      guardian = Guardian.new(user)
      expect(subject.perform_list_query(user, guardian).map(&:id)).to match_array([bookmark1.id, bookmark2.id])
    end

    it "does not return bookmarks for messages inside direct message chat channels the user cannot access" do
      dm_channel = Fabricate(:direct_message_channel)
      channel.update(chatable: dm_channel)
      expect(subject.perform_list_query(user, guardian)).to eq(nil)
      DirectMessageUser.create(user: user, direct_message_channel: dm_channel)
      bookmark1.reload
      user.reload
      guardian = Guardian.new(user)
      expect(subject.perform_list_query(user, guardian).map(&:id)).to match_array([bookmark1.id, bookmark2.id])
    end

    it "does not return bookmarks for deleted messages" do
      message1.trash!
      guardian = Guardian.new(user)
      expect(subject.perform_list_query(user, guardian).map(&:id)).to match_array([bookmark2.id])
    end
  end

  describe "#perform_search_query" do
    before do
      SearchIndexer.enable
    end

    it "returns bookmarks that match by name" do
      ts_query = Search.ts_query(term: "gotta", ts_config: "simple")
      expect(subject.perform_search_query(subject.perform_list_query(user, guardian), "%gotta%", ts_query).map(&:id)).to match_array([bookmark1.id])
    end

    it "returns bookmarks that match by chat message message content" do
      message2.update(message: "some good soup")

      ts_query = Search.ts_query(term: "good soup", ts_config: "simple")
      expect(subject.perform_search_query(subject.perform_list_query(user, guardian), "%good soup%", ts_query).map(&:id)).to match_array([bookmark2.id])

      ts_query = Search.ts_query(term: "blah", ts_config: "simple")
      expect(subject.perform_search_query(subject.perform_list_query(user, guardian), "%blah%", ts_query).map(&:id)).to eq([])
    end
  end

  describe "#can_send_reminder?" do
    it "cannot send the reminder if the message or channel is deleted" do
      expect(subject.can_send_reminder?(bookmark1)).to eq(true)
      bookmark1.bookmarkable.trash!
      bookmark1.reload
      expect(subject.can_send_reminder?(bookmark1)).to eq(false)
      ChatMessage.with_deleted.find_by(id: bookmark1.bookmarkable_id).recover!
      bookmark1.reload
      bookmark1.bookmarkable.chat_channel.trash!
      bookmark1.reload
      expect(subject.can_send_reminder?(bookmark1)).to eq(false)
    end
  end

  describe "#reminder_handler" do
    it "creates a notification for the user with the correct details" do
      expect { subject.send_reminder_notification(bookmark1) }.to change { Notification.count }.by(1)
      notif = user.notifications.last
      expect(notif.notification_type).to eq(Notification.types[:bookmark_reminder])
      expect(notif.data).to eq(
        {
          title: I18n.t(
            "chat.bookmarkable.notification_title",
            channel_name: bookmark1.bookmarkable.chat_channel.title(bookmark1.user)
          ),
          display_username: bookmark1.user.username,
          bookmark_name: bookmark1.name,
          bookmarkable_url: bookmark1.bookmarkable.url
        }.to_json
      )
    end
  end

  describe "#can_see?" do
    it "returns false if the chat message is in a channel the user cannot see" do
      expect(subject.can_see?(guardian, bookmark1)).to eq(true)
      bookmark1.bookmarkable.chat_channel.chatable.update(category: private_category)
      expect(subject.can_see?(guardian, bookmark1)).to eq(false)
      private_category.groups.last.add(user)
      bookmark1.reload
      user.reload
      guardian = Guardian.new(user)
      expect(subject.can_see?(guardian, bookmark1)).to eq(true)
    end
  end

  describe "#validate_before_create" do
    it "raises InvalidAccess if the user cannot see the chat channel" do
      expect { subject.validate_before_create(guardian, bookmark1.bookmarkable) }.not_to raise_error
      bookmark1.bookmarkable.chat_channel.chatable.update(category: private_category)
      expect { subject.validate_before_create(guardian, bookmark1.bookmarkable) }.to raise_error(Discourse::InvalidAccess)
      private_category.groups.last.add(user)
      bookmark1.reload
      user.reload
      guardian = Guardian.new(user)
      expect { subject.validate_before_create(guardian, bookmark1.bookmarkable) }.not_to raise_error(Discourse::InvalidAccess)
    end

    it "raises InvalidAccess if the chat message is deleted" do
      expect { subject.validate_before_create(guardian, bookmark1.bookmarkable) }.not_to raise_error
      bookmark1.bookmarkable.trash!
      bookmark1.reload
      expect { subject.validate_before_create(guardian, bookmark1.bookmarkable) }.to raise_error(Discourse::InvalidAccess)
    end
  end

  describe "#cleanup_deleted" do
    it "deletes bookmarks for chat messages deleted more than 3 days ago" do
      bookmark_post = Fabricate(:bookmark, bookmarkable: Fabricate(:post))
      bookmark1.bookmarkable.trash!
      bookmark1.bookmarkable.update!(deleted_at: 4.days.ago)
      subject.cleanup_deleted
      expect(Bookmark.exists?(id: bookmark1.id)).to eq(false)
      expect(Bookmark.exists?(id: bookmark2.id)).to eq(true)
      expect(Bookmark.exists?(id: bookmark_post.id)).to eq(true)
    end
  end
end
