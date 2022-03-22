import userFixtures from "discourse/tests/fixtures/user-fixtures";
import { cloneJSON } from "discourse-common/lib/object";
import {
  acceptance,
  exists,
  query,
  visible,
} from "discourse/tests/helpers/qunit-helpers";
import { click, currentURL, settled, visit } from "@ember/test-helpers";
import {
  chatChannels,
  chatView,
  directMessageChannels,
} from "discourse/plugins/discourse-chat/chat-fixtures";
import { test } from "qunit";
import { isLegacyEmber } from "discourse-common/config/environment";

if (!isLegacyEmber()) {
  acceptance("Discourse Chat - User card test", function (needs) {
    needs.user({
      admin: false,
      moderator: false,
      username: "eviltrout",
      id: 1,
      can_chat: true,
      has_chat_enabled: true,
    });
    needs.pretender((server, helper) => {
      server.post("/uploads/lookup-urls", () => {
        return helper.response([]);
      });
      server.get("/chat/chat_channels.json", () =>
        helper.response(chatChannels)
      );
      server.get("/chat/chat_channels/:channelId.json", () =>
        helper.response(helper.response(directMessageChannels[0]))
      );
      server.get("/chat/:chatChannelId/messages.json", () =>
        helper.response(chatView)
      );
      server.post("/chat/direct_messages/create.json", () => {
        return helper.response({
          chat_channel: {
            chat_channels: [],
            chatable: {
              users: [
                {
                  username: "hawk",
                  id: 2,
                  name: "hawk",
                  avatar_template:
                    "https://avatars.discourse.org/v3/letter/t/41988e/{size}.png",
                },
              ],
            },
            chatable_id: 16,
            chatable_type: "DirectMessageChannel",
            chatable_url: null,
            id: 75,
            last_read_message_id: null,
            title: "@hawk",
            unread_count: 0,
            unread_mentions: 0,
            last_message_sent_at: "2021-11-08T21:26:05.710Z",
          },
        });
      });
      let cardResponse = cloneJSON(userFixtures["/u/charlie/card.json"]);
      cardResponse.user.can_chat_user = true;
      server.get("/u/hawk/card.json", () => helper.response(cardResponse));
    });
    needs.settings({
      chat_enabled: true,
    });

    needs.hooks.beforeEach(function () {
      Object.defineProperty(this, "chatService", {
        get: () => this.container.lookup("service:chat"),
      });
      Object.defineProperty(this, "appEvents", {
        get: () => this.container.lookup("service:appEvents"),
      });
    });

    test("User card has message button that opens chat", async function (assert) {
      this.chatService.set("sidebarActive", false);
      await visit("/latest");
      this.appEvents.trigger("chat:toggle-open");
      await settled();
      await click(".chat-channel-row.chat-channel-9");
      await click("[data-user-card='hawk']");
      assert.ok(exists(".user-card-chat-btn"));
      await click(".user-card-chat-btn");
      assert.ok(visible(".topic-chat-float-container"), "chat float is open");
      assert.ok(
        query(".topic-chat-container").classList.contains("channel-75")
      );
    });
  });
}
