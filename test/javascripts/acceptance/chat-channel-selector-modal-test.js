import {
  acceptance,
  exists,
  queryAll,
  updateCurrentUser,
} from "discourse/tests/helpers/qunit-helpers";

import { next } from "@ember/runloop";
import {
  click,
  currentURL,
  fillIn,
  settled,
  triggerEvent,
  triggerKeyEvent,
  visit,
} from "@ember/test-helpers";
import {
  chatChannels,
  chatView,
} from "discourse/plugins/discourse-chat/chat-fixtures";
import { test } from "qunit";
import { isLegacyEmber } from "discourse-common/config/environment";
import { Promise } from "rsvp";

const chatSettled = async () => {
  await settled();
  if (isLegacyEmber()) {
    // In the legacy environment, settled() doesn't always seem to work for us
    // Using `next()` seems to work around the problem
    // This hack can be removed once we're 100% Ember CLI
    await new Promise((resolve) => {
      next(resolve);
    });
  }
};

acceptance(
  "Discourse Chat - chat channel selector modal test",
  function (needs) {
    needs.user({
      admin: false,
      moderator: false,
      username: "eviltrout",
      id: 1,
      can_chat: true,
      has_chat_enabled: true,
    });
    needs.pretender((server, helper) => {
      server.get("/chat/chat_channels.json", () =>
        helper.response(chatChannels)
      );
      server.get("/chat/:chatChannelId/messages.json", () =>
        helper.response(chatView)
      );
      server.post("/uploads/lookup-urls", () => {
        return helper.response([]);
      });
    });

    needs.settings({
      chat_enabled: true,
    });

    test("opens channel in float with chat not isolated", async function (assert) {
      updateCurrentUser({ chat_isolated: false });
      await visit("/latest");
      await triggerKeyEvent(document.body, "keydown", 75, { ctrlKey: true });
      assert.ok(exists("#chat-channel-selector-modal-inner"));

      // All 6 channels should show because the input is blank
      assert.equal(
        queryAll("#chat-channel-selector-modal-inner .chat-channel-row").length,
        6
      );

      await fillIn("#chat-channel-selector-input", "markvanlan");
      await chatSettled();
      // Only 2 channels match this filter now!
      assert.equal(
        queryAll("#chat-channel-selector-modal-inner .chat-channel-row").length,
        2
      );

      await triggerKeyEvent(document.body, "keydown", 13); // Enter key
      assert.ok(exists(".topic-chat-container.visible"));
      assert.notOk(exists("#chat-channel-selector-modal-inner"));
      assert.equal(currentURL(), "/latest");
    });

    test("opens full-page when chat is isolated", async function (assert) {
      updateCurrentUser({ chat_isolated: true });
      await visit("/latest");

      await triggerKeyEvent(document.body, "keydown", 75, { ctrlKey: true });
      await click(
        "#chat-channel-selector-modal-inner .chat-channel-row.chat-channel-75"
      );
      assert.notOk(exists("#chat-channel-selector-modal-inner"));
      assert.equal(currentURL(), "/chat/channel/75/@hawk");
    });

    test("the current chat channel does not show in the list", async function (assert) {
      await visit("/chat/channel/75/@hawk");
      await triggerKeyEvent(document.body, "keydown", 75, { ctrlKey: true });

      // Only 5 channels now instead of 6.
      assert.equal(
        queryAll("#chat-channel-selector-modal-inner .chat-channel-row").length,
        5
      );
      assert.notOk(
        exists(
          "#chat-channel-selector-modal-inner .chat-channel-row.chat-channel-75"
        )
      );
    });
  }
);
