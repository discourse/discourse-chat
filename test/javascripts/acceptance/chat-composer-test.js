import {
  acceptance,
  exists,
  publishToMessageBus,
  query,
} from "discourse/tests/helpers/qunit-helpers";
import { click, fillIn, settled, visit } from "@ember/test-helpers";
import { test } from "qunit";
import { chatChannelPretender } from "../helpers/chat-pretenders";

let sendAttempt = 0;

acceptance("Discourse Chat - Composer - unreliable network", function (needs) {
  needs.user({ id: 1, has_chat_enabled: true });
  needs.settings({ chat_enabled: true });
  needs.pretender((server, helper) => {
    chatChannelPretender(server, helper);
    server.get("/chat/:id/messages.json", () =>
      helper.response({ chat_messages: [], meta: {} })
    );
    server.post("/chat/drafts", () => helper.response(500, {}));
    server.post("/chat/:id.json", () => {
      sendAttempt += 1;
      return sendAttempt === 1
        ? helper.response(500, {})
        : helper.response({ success: true });
    });
  });

  needs.hooks.beforeEach(function () {
    Object.defineProperty(this, "chatService", {
      get: () => this.container.lookup("service:chat"),
    });
  });

  needs.hooks.afterEach(function () {
    sendAttempt = 0;
  });

  test("Sending a message with unreliable network", async function (assert) {
    this.chatService.set("chatWindowFullPage", false);
    await visit("/chat/channel/11/-");
    await fillIn(".chat-composer-input", "network-error-message");
    await click(".send-btn");

    assert.ok(
      exists(".chat-message-container[data-id='1'] .retry-staged-message-btn"),
      "it adds a retry button"
    );

    await fillIn(".chat-composer-input", "network-error-message");
    await click(".send-btn");
    await publishToMessageBus(`/chat/11`, {
      type: "sent",
      stagedId: 1,
      chat_message: {
        cooked: "network-error-message",
        id: 175,
        user: { id: 1 },
      },
    });

    assert.notOk(
      exists(".chat-message-container[data-id='1'] .retry-staged-message-btn"),
      "it removes the staged message"
    );
    assert.ok(
      exists(".chat-message-container[data-id='175']"),
      "it sends the message"
    );
    assert.strictEqual(
      query(".chat-composer-input").value,
      "",
      "it clears the input"
    );
  });

  test("Draft with unreliable network", async function (assert) {
    this.chatService.set("chatWindowFullPage", false);
    await visit("/chat/channel/11/-");
    this.chatService.set("isNetworkUnreliable", true);
    await settled();

    assert.ok(
      exists(".chat-composer__unreliable-network"),
      "it displays a network error icon"
    );
  });
});
