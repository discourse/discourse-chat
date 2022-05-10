# frozen_string_literal: true

class ChatMessageBookmarkable < BaseBookmarkable
  def self.model
    ChatMessage
  end

  def self.serializer
    UserChatMessageBookmarkSerializer
  end

  def self.preload_associations
    [:chat_channel]
  end

  def self.list_query(user, guardian)
    user.bookmarks_of_type("ChatMessage").joins(
      "INNER JOIN chat_messages ON chat_messages.id = bookmarks.bookmarkable_id AND
        bookmarks.bookmarkable_type = 'ChatMessage'"
    )
  end

  def self.search_query(bookmarks, query, ts_query, &bookmarkable_search)
    bookmarkable_search.call(bookmarks, "chat_messages.message ILIKE :q")
  end

  def self.reminder_handler(bookmark)
    bookmark.user.notifications.create!(
      notification_type: Notification.types[:bookmark_reminder],
      data: {
        title: I18n.t(
          "chat.bookmarkable.notification_title",
          channel_name: bookmark.bookmarkable.chat_channel.title(bookmark.user)
        ),
        display_username: bookmark.user.username,
        bookmark_name: bookmark.name,
        bookmarkable_url: bookmark.bookmarkable.url
      }.to_json
    )
  end

  def self.reminder_conditions(bookmark)
    bookmark.bookmarkable.present? && bookmark.bookmarkable.chat_channel.present?
  end

  def self.can_see?(guardian, bookmark)
    guardian.can_see_chat_channel?(bookmark.bookmarkable.chat_channel)
  end
end
