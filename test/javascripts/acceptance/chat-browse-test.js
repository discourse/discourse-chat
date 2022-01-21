import {
  acceptance,
  exists,
  query,
  updateCurrentUser,
  visible,
} from "discourse/tests/helpers/qunit-helpers";
import { click, visit } from "@ember/test-helpers";
import { test } from "qunit";

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
      settingsRow.querySelector(".channel-title-container .edit-btn")
    );
    assert.ok(exists(".channel-name-edit-container"));
    await fillIn(".channel-name-edit-container .name-input", editedChannelName);
    await click(
      settingsRow.querySelector(".channel-name-edit-container .save-btn")
    );
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
  });

  test("Chat browsing shows no channels", async function (assert) {
    await visit("/chat/browse");
    assert.notOk(visible(".chat-channel-settings-row"));

    assert.equal(
      query(".empty-state-title").innerText,
      "There are no channels for you to join yet."
    );
    assert.equal(
      query(".empty-state-body").innerText,
      "You can reach out to your administrator to start enabling chat for topics or categories."
    );
  });
});
