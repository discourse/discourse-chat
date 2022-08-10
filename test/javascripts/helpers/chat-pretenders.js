import {
  chatChannels,
  directMessageChannels,
  generateChatView,
} from "discourse/plugins/discourse-chat/chat-fixtures";

import { cloneJSON } from "discourse-common/lib/object";
import User from "discourse/models/user";

export function baseChatPretenders(server, helper) {
  server.get("/chat/:chatChannelId/messages.json", () =>
    helper.response(generateChatView(User.current()))
  );

  server.post("/chat/:chatChannelId.json", () => {
    return helper.response({ success: "OK" });
  });

  server.get("/notifications", () => {
    return helper.response({
      notifications: [
        {
          id: 42,
          user_id: 1,
          notification_type: 29,
          read: false,
          high_priority: true,
          created_at: "2021-01-01 12:00:00 UTC",
          fancy_title: "First notification",
          post_number: null,
          topic_id: null,
          slug: null,
          data: {
            chat_message_id: 174,
            chat_channel_id: 9,
            chat_channel_title: "Site",
            mentioned_by_username: "hawk",
          },
        },
        {
          id: 43,
          user_id: 1,
          notification_type: 29,
          read: false,
          high_priority: true,
          created_at: "2021-01-01 12:00:00 UTC",
          fancy_title: "Second notification",
          post_number: null,
          topic_id: null,
          slug: null,
          data: {
            identifier: "engineers",
            is_group: true,
            chat_message_id: 174,
            chat_channel_id: 9,
            chat_channel_title: "Site",
            mentioned_by_username: "hawk",
          },
        },
        {
          id: 44,
          user_id: 1,
          notification_type: 29,
          read: false,
          high_priority: true,
          created_at: "2021-01-01 12:00:00 UTC",
          fancy_title: "Third notification",
          post_number: null,
          topic_id: null,
          slug: null,
          data: {
            identifier: "all",
            chat_message_id: 174,
            chat_channel_id: 9,
            chat_channel_title: "Site",
            mentioned_by_username: "hawk",
          },
        },
        {
          id: 45,
          user_id: 1,
          notification_type: 31,
          read: false,
          high_priority: true,
          created_at: "2021-01-01 12:00:00 UTC",
          fancy_title: "Fourth notification",
          post_number: null,
          topic_id: null,
          slug: null,
          data: {
            message: "chat.invitation_notification",
            chat_message_id: 174,
            chat_channel_id: 9,
            chat_channel_title: "Site",
            invited_by_username: "hawk",
          },
        },
      ],
      seen_notification_id: null,
    });
  });

  server.get("/chat/lookup/:messageId.json", () =>
    helper.response(generateChatView(User.current()))
  );

  server.post("/uploads/lookup-urls", () => {
    return helper.response([]);
  });

  server.get("/chat/api/category-chatables/:categoryId/permissions.json", () =>
    helper.response({ allowed_groups: ["@everyone"], private: false })
  );
}

export function directMessageChannelPretender(
  server,
  helper,
  opts = { unread_count: 0, muted: false }
) {
  let copy = cloneJSON(directMessageChannels[0]);
  copy.chat_channel.current_user_membership.unread_count = opts.unread_count;
  copy.chat_channel.current_user_membership.muted = opts.muted;
  server.get("/chat/chat_channels/75.json", () => helper.response(copy));
}

export function chatChannelPretender(server, helper, changes = []) {
  // changes is [{ id: X, unread_count: Y, muted: true}]
  let copy = cloneJSON(chatChannels);
  changes.forEach((change) => {
    let found;
    found = copy.public_channels.find((c) => c.id === change.id);
    if (found) {
      found.current_user_membership.unread_count = change.unread_count;
      found.current_user_membership.muted = change.muted;
    }
    if (!found) {
      found = copy.direct_message_channels.find((c) => c.id === change.id);
      if (found) {
        found.current_user_membership.unread_count = change.unread_count;
        found.current_user_membership.muted = change.muted;
      }
    }
  });
  server.get("/chat/chat_channels.json", () => helper.response(copy));
}
