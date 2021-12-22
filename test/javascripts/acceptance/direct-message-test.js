import { acceptance, queryAll } from "discourse/tests/helpers/qunit-helpers";
import { visit } from "@ember/test-helpers";
import { test } from "qunit";
import { baseChatPretenders, chatChannelPretender } from "./chat-test";

acceptance("Discourse Chat - Direct Messages", function (needs) {
  needs.user({
    admin: false,
    moderator: false,
    username: "zeviltrout",
    id: 1,
    can_chat: true,
    has_chat_enabled: true,
  });
  needs.settings({
    chat_enabled: true,
  });
  needs.pretender((server, helper) => {
    baseChatPretenders(server, helper);
    chatChannelPretender(server, helper);
  });

  test("Shows DM to self at the top", async (assert) => {
    const directMessageChatRowSelector =
      ".direct-message-channels .chat-channel-row";

    await visit("/chat");

    assert.strictEqual(
      queryAll(directMessageChatRowSelector)[0].innerText,
      "zeviltrout",
      "DM to myself will appear at the top"
    );
    assert.strictEqual(
      queryAll(directMessageChatRowSelector)[1].innerText,
      "2 markvanlan, hawk",
      "Followed by any other DMs"
    );
  });
});
