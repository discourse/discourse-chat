import { click, fillIn, visit } from "@ember/test-helpers";
import selectKit from "discourse/tests/helpers/select-kit-helper";
import {
  allChannels,
  chatChannels,
  chatView,
} from "discourse/plugins/discourse-chat/chat-fixtures";
import { acceptance, query } from "discourse/tests/helpers/qunit-helpers";
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

acceptance("Discourse Chat - Archive channel", function (needs) {
  let archiveChannelRequestPayload = null;

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
    chat_allow_archiving_channels: true,
  });

  needs.pretender((server, helper) => {
    baseChatPretenders(server, helper);
    server.put(
      "/chat/chat_channels/:chat_channel_id/archive.json",
      (fakeRequest) => {
        archiveChannelRequestPayload = fakeRequest.requestBody;
        return helper.response([]);
      }
    );
  });

  test("it allows admins to archive the chat channel", async function (assert) {
    await visit("/chat/channel/7/Uncategorized");

    await click(
      "#chat-channel-row-7 .chat-channel-settings-btn .select-kit-header-wrapper"
    );
    await click("li[data-value='archiveChannel']");
    assert.ok(exists("#chat-channel-archive-modal-inner"));

    await click("#move-to-new-topic");
    await fillIn(
      "#split-topic-name",
      "The Jedi Archives Which Are Definitely Not Incomplete"
    );

    await selectKit("#new-topic-category-selector").expand();
    await selectKit("#new-topic-category-selector").selectRowByValue(6); // support category

    await click("#chat-confirm-archive-channel");
    assert.strictEqual(
      archiveChannelRequestPayload,
      "type=newTopic&chat_channel_id=7&title=The+Jedi+Archives+Which+Are+Definitely+Not+Incomplete&category_id=6&tags="
    );

    assert.strictEqual(
      query("#modal-alert").innerText,
      I18n.t("chat.channel_archive.process_started")
    );
  });
});

acceptance("Discourse Chat - Archive channel for non-admin", function (needs) {
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
    chat_allow_archiving_channels: true,
  });

  needs.pretender((server, helper) => {
    baseChatPretenders(server, helper);
  });

  test("it does not allow non-admin to archive chat channels", async function (assert) {
    await visit("/chat/channel/7/Uncategorized");

    assert.notOk(exists("#chat-channel-row-7 .chat-channel-settings-btn"));
  });
});

acceptance(
  "Discourse Chat - Archive channel for admin when not chat_allow_archiving_channels",
  function (needs) {
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
      chat_allow_archiving_channels: false,
    });

    needs.pretender((server, helper) => {
      baseChatPretenders(server, helper);
    });

    test("it does not allow admin to archive chat channels if that is disabled for the site", async function (assert) {
      await visit("/chat/channel/7/Uncategorized");

      assert.notOk(exists("#chat-channel-row-7 .chat-channel-settings-btn"));
    });
  }
);
