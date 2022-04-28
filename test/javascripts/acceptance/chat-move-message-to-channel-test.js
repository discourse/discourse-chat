import { test } from "qunit";
import { isLegacyEmber } from "discourse-common/config/environment";
import { click, currentURL, tap, visit } from "@ember/test-helpers";
import {
  acceptance,
  exists,
  query,
  visible,
} from "discourse/tests/helpers/qunit-helpers";
import {
  chatChannels,
  chatView,
} from "discourse/plugins/discourse-chat/chat-fixtures";
import selectKit from "discourse/tests/helpers/select-kit-helper";

function setupPretenders(server, helper) {
  server.get("/chat/chat_channels.json", () => helper.response(chatChannels));
  server.get("/chat/:chat_channel_id/messages.json", () =>
    helper.response(chatView)
  );
  server.post("/uploads/lookup-urls", () => {
    return helper.response([]);
  });
  server.put("/chat/7/move_messages_to_channel.json", () => {
    return helper.response({
      destination_channel_id: 11,
      destination_channel_title: "Coolest thing you have seen today",
      first_moved_message_id: 174,
    });
  });
  server.get("/chat/lookup/:messageId.json", () => helper.response(chatView));
}

acceptance(
  "Discourse Chat | moving messages to a channel | staff user",
  function (needs) {
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
      setupPretenders(server, helper);
    });

    test("opens a modal for destination channel selection then redirects to the moved messages when done", async function (assert) {
      await visit("/chat/channel/7/Uncategorized");
      assert.ok(exists(".chat-message-container"));
      const firstMessage = query(".chat-message-container");
      const dropdown = selectKit(".chat-message-container .more-buttons");
      await dropdown.expand();
      await dropdown.selectRowByValue("selectMessage");

      assert.ok(firstMessage.classList.contains("selecting-messages"));
      const moveToChannelBtn = query(
        ".chat-live-pane #chat-move-to-channel-btn"
      );
      assert.equal(
        moveToChannelBtn.disabled,
        false,
        "button is enabled as a message is selected"
      );

      await click(firstMessage.querySelector("input[type='checkbox']"));
      assert.equal(
        moveToChannelBtn.disabled,
        true,
        "button is disabled when no messages are selected"
      );

      await click(firstMessage.querySelector("input[type='checkbox']"));
      await click("#chat-move-to-channel-btn");
      const modalConfirmMoveButton = query(
        "#chat-confirm-move-messages-to-channel"
      );
      assert.ok(
        modalConfirmMoveButton.disabled,
        "cannot confirm move until channel is selected"
      );
      const channelChooser = selectKit(".chat-move-message-channel-chooser");
      await channelChooser.expand();
      await channelChooser.selectRowByValue("11");
      await click(modalConfirmMoveButton);
      assert.strictEqual(
        currentURL(),
        "/chat/channel/11/Coolest%20thing%20you%20have%20seen%20today",
        "it goes to the destination channel after the move"
      );
    });
  }
);

acceptance(
  "Discourse Chat | moving messages to a channel | non-staff user",
  function (needs) {
    needs.user({
      admin: false,
      moderator: false,
      username: "eviltrout",
      id: 1,
      can_chat: true,
      has_chat_enabled: true,
    });

    needs.settings({
      chat_enabled: true,
    });

    needs.pretender((server, helper) => {
      setupPretenders(server, helper);
    });

    test("non-staff users cannot see the move to channel button", async function (assert) {
      await visit("/chat/channel/7/Uncategorized");
      assert.ok(exists(".chat-message-container"));
      const firstMessage = query(".chat-message-container");
      const dropdown = selectKit(".chat-message-container .more-buttons");
      await dropdown.expand();
      await dropdown.selectRowByValue("selectMessage");

      assert.ok(firstMessage.classList.contains("selecting-messages"));
      assert.notOk(
        exists(".chat-live-pane #chat-move-to-channel-btn"),
        "non-staff users cannot see the move to channel button"
      );
    });
  }
);
