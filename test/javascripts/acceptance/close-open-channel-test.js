import { click, visit } from "@ember/test-helpers";
import {
  allChannels,
  chatChannels,
  chatView,
} from "discourse/plugins/discourse-chat/chat-fixtures";
import {
  acceptance,
  exists,
  query,
} from "discourse/tests/helpers/qunit-helpers";
import I18n from "I18n";
import { test } from "qunit";

const baseChatPretenders = (server, helper) => {
  server.get("/chat/:chatChannelId/messages.json", () =>
    helper.response(chatView)
  );
  server.post("/chat/:chatChannelId.json", () => {
    return helper.response({ success: "OK" });
  });
  server.get("/chat/lookup/:message_id.json", () => helper.response(chatView));
  server.post("/uploads/lookup-urls", () => {
    return helper.response([]);
  });
  server.get("/chat/chat_channels/all.json", () => {
    return helper.response(allChannels());
  });
  server.get("/chat/chat_channels.json", () => {
    return helper.response(chatChannels);
  });
};

acceptance("Discourse Chat - Close and open channel", function (needs) {
  let changeStatusPayload = null;

  needs.user({
    admin: true,
    moderator: true,
    username: "tomtom",
    id: 1,
    can_chat: true,
    has_chat_enabled: true,
  });

  needs.settings({
    chat_enabled: true,
  });

  needs.pretender((server, helper) => {
    baseChatPretenders(server, helper);
    server.put(
      "/chat/chat_channels/:chat_channel_id/change_status.json",
      (fakeRequest) => {
        changeStatusPayload = fakeRequest.requestBody;
        return helper.response([]);
      }
    );
  });

  test("it allows admins to close and open the chat channel from the chat browse page", async function (assert) {
    await visit("/chat/browse");

    await click(
      ".chat-channel-settings-row-7 .chat-channel-settings-btn .select-kit-header-wrapper"
    );
    await click("li[data-value='showToggleOpenModal']");
    assert.ok(exists("#chat-channel-toggle-open-modal-inner"));

    await click("#chat-confirm-toggle-open-channel");
    assert.strictEqual(changeStatusPayload, "status=closed");

    assert.strictEqual(
      query(
        ".chat-channel-settings-row-7 .chat-channel-status"
      ).innerText.trim(),
      I18n.t("chat.channel_status.closed")
    );

    await click(
      ".chat-channel-settings-row-7 .chat-channel-settings-btn .select-kit-header-wrapper"
    );
    await click("li[data-value='showToggleOpenModal']");
    assert.ok(exists("#chat-channel-toggle-open-modal-inner"));

    await click("#chat-confirm-toggle-open-channel");
    assert.strictEqual(changeStatusPayload, "status=open");
  });
});

acceptance(
  "Discourse Chat - Close/open channel for non-admin",
  function (needs) {
    needs.user({
      admin: false,
      moderator: false,
      username: "tomtom",
      id: 1,
      can_chat: true,
      has_chat_enabled: true,
    });

    needs.settings({
      chat_enabled: true,
    });

    needs.pretender((server, helper) => {
      baseChatPretenders(server, helper);
    });

    test("it does not allow non-admin to close/open chat channels", async function (assert) {
      await visit("/chat/browse");

      assert.notOk(
        exists(".chat-channel-settings-row-7 .chat-channel-settings-btn")
      );
    });
  }
);
