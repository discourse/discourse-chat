import { click, fillIn, settled, visit } from "@ember/test-helpers";
import {
  acceptance,
  exists,
  publishToMessageBus,
  query,
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

    let loadAllMessages = false;

    needs.hooks.beforeEach(() => {
      loadAllMessages = false;
    });

    needs.pretender((server, helper) => {
      server.get("/chat/:chatChannelId/messages.json", () => {
        if (loadAllMessages) {
          return helper.response({
            meta: {
              can_load_more_future: false,
            },
            chat_messages: [
              buildMessage(1),
              buildMessage(2),
              buildMessage(3),
              buildMessage(4),
            ],
          });
        } else {
          return helper.response({
            meta: {
              can_flag: true,
              user_silenced: false,
              can_load_more_future: true,
            },
            chat_messages: [buildMessage(1), buildMessage(2)],
          });
        }
      });

      server.get("/chat/chat_channels.json", () =>
        helper.response({
          public_channels: [
            {
              id: 1,
              title: "something",
              current_user_membership: { following: true },
            },
          ],
          direct_message_channels: [],
        })
      );

      server.get("/chat/chat_channels/:chatChannelId", () =>
        helper.response({ id: 1, title: "something" })
      );

      server.post("/chat/drafts", () => {
        return helper.response([]);
      });

      server.post("/chat/:chatChannelId.json", () => {
        return helper.response({ success: "OK" });
      });
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

    test("Sending a new message when there are still unloaded ones will fetch them", async function (assert) {
      await visit("/chat/channel/1/cat");

      assert.notOk(exists(`.chat-message-container[data-id='${3}']`));

      loadAllMessages = true;
      const composerInput = query(".chat-composer-input");
      await fillIn(composerInput, "test text");
      await click(".send-btn");
      await settled();

      assert.ok(exists(`.chat-message-container[data-id='${3}']`));
      assert.ok(exists(`.chat-message-container[data-id='${4}']`));
    });
  }
);
