import { click, fillIn, visit } from "@ember/test-helpers";
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
import { test } from "qunit";

const baseChatPretenders = (server, helper) => {
  server.get("/chat/:chatChannelId/messages.json", () =>
    helper.response(chatView)
  );
  server.post("/chat/:chatChannelId.json", () => {
    return helper.response({ success: "OK" });
  });
  server.get("/chat/lookup/:messageId.json", () => helper.response(chatView));
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

acceptance("Discourse Chat - Delete channel", function (needs) {
  let deletePayload = null;

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
    server.delete(
      "/chat/chat_channels/:chat_channel_id.json",
      (fakeRequest) => {
        deletePayload = fakeRequest.requestBody;
        return helper.response([]);
      }
    );
  });

  test("it allows staff to delete the chat channel", async function (assert) {
    await visit("/chat/browse");

    await click(
      ".chat-channel-settings-row-7 .chat-channel-settings-btn .select-kit-header-wrapper"
    );
    await click("li[data-value='deleteChannel']");
    assert.ok(exists("#chat-channel-delete-modal-inner"));
    assert.ok(
      query("#chat-confirm-delete-channel").disabled,
      "delete confirmation should be disabled until channel name confirmation is filled in"
    );
    await fillIn("#channel-delete-confirm-name", "Uncategorized");
    assert.notOk(query("#chat-confirm-delete-channel").disabled);

    await click("#chat-confirm-delete-channel");
    assert.strictEqual(
      deletePayload,
      "channel_name_confirmation=Uncategorized"
    );

    assert.notOk(
      exists(".chat-channel-settings-row-7 .chat-channel-status"),
      "channel is removed from browse list after deleting"
    );
  });
});

acceptance("Discourse Chat - Delete channel for non-staff", function (needs) {
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

  test("it does not allow non-staff to delete chat channels", async function (assert) {
    await visit("/chat/browse");

    assert.notOk(
      exists(".chat-channel-settings-row-7 .chat-channel-settings-btn")
    );
  });
});
