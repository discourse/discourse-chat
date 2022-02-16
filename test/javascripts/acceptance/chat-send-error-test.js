import { test } from "qunit";
import { fillIn, settled, triggerKeyEvent, visit } from "@ember/test-helpers";
import {
  acceptance,
  publishToMessageBus,
  query,
  queryAll,
} from "discourse/tests/helpers/qunit-helpers";
import {
  chatChannels,
  chatView,
} from "discourse/plugins/discourse-chat/chat-fixtures";
import { isLegacyEmber } from "discourse-common/config/environment";

const ERROR_MESSAGE = "too fast bruh!";

if (!isLegacyEmber()) {
  acceptance("Discourse Chat | Send error", function (needs) {
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
      server.get("/chat/chat_channels.json", () =>
        helper.response(chatChannels)
      );
      server.get("/chat/:chat_channel_id/messages.json", () =>
        helper.response(chatView)
      );
      server.post("/uploads/lookup-urls", () => {
        return helper.response([]);
      });
      server.post("/chat/drafts", () => helper.response({ success: true }));
      server.post("/chat/9.json", () => {
        return helper.response(429, {
          success: false,
          errors: [ERROR_MESSAGE],
        });
      });
    });

    test("Being rate limited shows try again button, and it's cleared with a retry", async function (assert) {
      await visit("/chat/channel/9/Site");
      const composerInput = query(".chat-composer-input");
      await fillIn(composerInput, "newmessages");
      await focus(composerInput);
      await triggerKeyEvent(composerInput, "keydown", 13); // 13 is enter keycode
      const chatMessages = queryAll(".chat-message");
      const lastChatMessage = chatMessages[chatMessages.length - 1];
      assert.ok(lastChatMessage.classList.contains("chat-message-staged"));
      assert.ok(lastChatMessage.classList.contains("errored"));
      assert.ok(lastChatMessage.innerText.includes(ERROR_MESSAGE));
      assert.ok(lastChatMessage.querySelector(".try-sending-again"));

      publishToMessageBus("/chat/9", {
        typ: "sent",
        stagedId: 1,
        chat_message: {
          id: 202,
          user: {
            id: 1,
          },
        },
      });
      await settled();

      assert.notOk(lastChatMessage.classList.contains("chat-message-staged"));
      assert.notOk(lastChatMessage.classList.contains("errored"));
      assert.notOk(lastChatMessage.innerText.includes(ERROR_MESSAGE));
      assert.notOk(lastChatMessage.querySelector(".try-sending-again"));
    });
  });
}
