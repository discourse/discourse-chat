import { settled, visit } from "@ember/test-helpers";
import {
  acceptance,
  exists,
  publishToMessageBus,
} from "discourse/tests/helpers/qunit-helpers";
import { test } from "qunit";

function buildMessage(messageId) {
  return {
    id: messageId,
    message: "hi",
    cooked: "<p>hi</p>",
    excerpt: "hi",
    created_at: "2021-07-20T08:14:16.950Z",
    flag_count: 0,
    user: {
      avatar_template: "/letter_avatar_proxy/v4/letter/t/a9a28c/{size}.png",
      id: 1,
      name: "Tomtom",
      username: "tomtom",
    },
  };
}

acceptance(
  "Discourse Chat - Chat live pane - viewing old messages",
  function (needs) {
    needs.user({
      username: "eviltrout",
      id: 1,
      can_chat: true,
      has_chat_enabled: true,
    });
    needs.settings({
      chat_enabled: true,
    });
    needs.pretender((server, helper) => {
      server.get("/chat/:chatChannelId/messages.json", () =>
        helper.response({
          meta: {
            can_flag: true,
            user_silenced: true,
            can_load_more_future: true,
          },
          chat_messages: [buildMessage(1), buildMessage(2)],
        })
      );

      server.get("/chat/chat_channels.json", () =>
        helper.response({
          public_channels: [],
          direct_message_channels: [],
        })
      );

      server.get("/chat/chat_channels/:chatChannelId", () =>
        helper.response({ chat_channel: { id: 1, title: "something" } })
      );
    });

    test("doesn't create a gap in history by adding new messages", async function (assert) {
      await visit("/chat/channel/1/cat");

      publishToMessageBus("/chat/1", {
        type: "sent",
        chat_message: {
          id: 3,
          cooked: "<p>hello!</p>",
          user: {
            id: 2,
          },
        },
      });
      await settled();

      assert.notOk(exists(`.chat-message-container[data-id='${3}']`));
    });

    test("It continues to handle other message types", async function (assert) {
      await visit("/chat/channel/1/cat");

      publishToMessageBus("/chat/1", {
        action: "add",
        user: { id: 77, username: "notTomtom" },
        emoji: "cat",
        type: "reaction",
        chat_message_id: 1,
      });
      await settled();

      assert.ok(exists(".chat-message-reaction.cat"));
    });
  }
);
