import {
  acceptance,
  exists,
  query,
  updateCurrentUser,
} from "discourse/tests/helpers/qunit-helpers";
import { click, currentURL, fillIn, visit } from "@ember/test-helpers";
import { test } from "qunit";
import I18n from "I18n";

acceptance("Discourse Chat - chat browsing", function (needs) {
  const editedChannelName = "this is an edit test!";

  needs.user({
    admin: true,
    moderator: true,
    username: "eviltrout",
    id: 1,
    can_chat: true,
    has_chat_enabled: true,
  });
  needs.settings({
    chat_enabled: true,
  });
  needs.pretender((server, helper) => {
    server.get("/chat/chat_channels/all.json", () => {
      return helper.response([
        {
          id: 1,
          chatable_id: 1,
          chatable_type: "Category",
          chatable: {},
          following: true,
        },
      ]);
    });

    server.get("/chat/chat_channels.json", () =>
      helper.response({
        public_channels: [],
        direct_message_channels: [],
      })
    );

    server.post("/chat/chat_channels/:chatChannelId/unfollow", () => {
      return helper.response({ success: "OK" });
    });
    server.post("/chat/chat_channels/:chat_channel_id", () => {
      return helper.response({
        chat_channel: {
          title: editedChannelName,
        },
      });
    });
  });

  test("Chat browse controls", async function (assert) {
    await visit("/chat/browse");
    const settingsRow = query(".chat-channel-settings-row");
    assert.ok(
      settingsRow.querySelector(".chat-channel-expand-settings"),
      "Expand notifications button is present"
    );
    assert.ok(
      settingsRow.querySelector(".chat-channel-unfollow"),
      "Unfollow button is present"
    );
    await click(".chat-channel-expand-settings");
    assert.ok(exists(".chat-channel-row-controls"), "Controls are present");

    await click(".chat-channel-unfollow");
    assert.notOk(
      settingsRow.querySelector(".chat-channel-expand-settings"),
      "Expand notifications button is gone"
    );
    assert.notOk(
      settingsRow.querySelector(".chat-channel-unfollow"),
      "Unfollow button is gone"
    );

    assert.ok(
      settingsRow.querySelector(".chat-channel-preview"),
      "Preview channel button is present"
    );
    assert.ok(
      settingsRow.querySelector(".chat-channel-follow"),
      "Follow button is present"
    );
  });

  test("Chat browse - edit name is present for staff", async function (assert) {
    updateCurrentUser({ admin: true, moderator: true });
    await visit("/chat/browse");
    const settingsRow = query(".chat-channel-settings-row");
    await click(
      settingsRow.querySelector(
        ".channel-title-container .channel-title .edit-btn"
      )
    );
    assert.ok(exists(".channel-name-edit"));
    await fillIn(".channel-name-edit .name-input", editedChannelName);
    await click(settingsRow.querySelector(".channel-name-edit .save-btn"));
    assert.equal(
      settingsRow.querySelector(".chat-channel-title").innerText.trim(),
      editedChannelName
    );
  });

  test("Chat browse - edit name is hidden for normal user", async function (assert) {
    updateCurrentUser({ admin: false, moderator: false });
    await visit("/chat/browse");
    assert.notOk(
      exists(".chat-channel-settings-row .channel-title-container .edit-btn")
    );
  });
});

acceptance("Discourse Chat - chat browsing no channels", function (needs) {
  needs.user({
    admin: true,
    moderator: true,
    username: "eviltrout",
    id: 1,
    can_chat: true,
    has_chat_enabled: true,
  });
  needs.settings({
    chat_enabled: true,
  });
  needs.pretender((server, helper) => {
    server.get("/chat/chat_channels/all.json", () => {
      return helper.response([]);
    });

    server.get("/chat/chat_channels.json", () =>
      helper.response({
        public_channels: [],
        direct_message_channels: [],
      })
    );
    const hawkAsJson = {
      username: "hawk",
      id: 2,
      name: "hawk",
      avatar_template:
        "https://avatars.discourse.org/v3/letter/t/41988e/{size}.png",
    };
    server.get("/u/search/users", () => {
      return helper.response({
        users: [hawkAsJson],
      });
    });
    server.post("/chat/direct_messages/create.json", () => {
      return helper.response({
        chat_channel: {
          chat_channels: [],
          chatable: { users: [hawkAsJson] },
          chatable_id: 16,
          chatable_type: "DirectMessageChannel",
          chatable_url: null,
          id: 75,
          last_read_message_id: null,
          title: "@hawk",
          unread_count: 0,
          unread_mentions: 0,
          last_message_sent_at: "2021-11-08T21:26:05.710Z",
        },
      });
    });
    server.get("/chat/chat_channels/:chatChannelId", () => {
      return helper.response({
        chat_channel: {
          id: 75,
        },
      });
    });
    server.get("/chat/:chatChannelId/messages.json", () => {
      return helper.response({
        meta: {
          can_flag: true,
          user_silenced: false,
        },
        chat_messages: [],
      });
    });
    server.get("/chat/direct_messages.json", () => {
      return helper.response({
        chat_channel: {
          id: 75,
          title: "hawk",
        },
      });
    });
    server.get("/u/hawk/card.json", () => {
      return helper.response({});
    });
  });

  test("Chat browsing shows empty state with create dm UI", async function (assert) {
    await visit("/chat/browse");
    assert.notOk(exists(".chat-channel-settings-row"));
    assert.ok(exists(".start-creating-dm-btn"));

    await click(".start-creating-dm-btn");

    assert.equal(
      currentURL(),
      `/chat/channel/draft/${encodeURIComponent(
        I18n.t("chat.direct_message_creator.title")
      )}`
    );
    assert.ok(exists(".direct-message-creator"));

    await fillIn(".filter-usernames", "hawk");
    await click('.chat-user-avatar-container[data-user-card="hawk"]');

    assert.equal(
      query(".chat-composer-input").placeholder,
      I18n.t("chat.placeholder_start_conversation", { usernames: "hawk" })
    );
  });
});
