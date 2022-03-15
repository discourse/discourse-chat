import { click, fillIn, settled, visit } from "@ember/test-helpers";
import { cloneJSON } from "discourse-common/lib/object";
import selectKit from "discourse/tests/helpers/select-kit-helper";
import {
  allChannels,
  chatChannels,
  chatView,
  siteChannel,
} from "discourse/plugins/discourse-chat/chat-fixtures";
import {
  acceptance,
  exists,
  publishToMessageBus,
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
    let copy = cloneJSON(chatChannels);
    let topicChannel = copy.public_channels.find((pc) => pc.id === 4);
    topicChannel.unread_count = 2;
    return helper.response(copy);
  });

  // this is only fetched on channel-status change; when expanding on
  // this test we may want to introduce some counter to track when
  // this is fetched if we want to return different statuses
  server.get("/chat/chat_channels/4", () => {
    let channel = cloneJSON(
      chatChannels.public_channels.find((pc) => pc.id === 4)
    );
    channel.status = "archived";
    return helper.response({
      chat_channel: channel,
    });
  });
};

function siteChannelPretender(
  server,
  helper,
  opts = { unread_count: 0, muted: false }
) {
  let copy = cloneJSON(siteChannel);
  copy.chat_channel.unread_count = opts.unread_count;
  server.get("/chat/chat_channels/9.json", () => helper.response(copy));
}

acceptance(
  "Discourse Chat - Respond to /chat/channel-status archive message",
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
      chat_allow_archiving_channels: true,
    });

    needs.pretender((server, helper) => {
      baseChatPretenders(server, helper);
    });

    test("it clears any unread messages in the sidebar for the archived channel", async function (assert) {
      await visit("/chat/channel/7/Uncategorized");
      assert.ok(
        exists("#chat-channel-row-4 .chat-channel-unread-indicator"),
        "unread indicator shows for channel"
      );

      publishToMessageBus("/chat/channel-status", {
        chat_channel_id: 4,
        status: "archived",
      });
      await settled();
      assert.notOk(
        exists("#chat-channel-row-4 .chat-channel-unread-indicator"),
        "unread indicator should not show after archive status change"
      );
    });

    test("it changes the channel status in the header to archived", async function (assert) {
      await visit("/chat/channel/4/Topic");
      assert.notOk(
        exists(".chat-channel-title-with-status .chat-channel-status"),
        "channel status does not show if the channel is open"
      );

      publishToMessageBus("/chat/channel-status", {
        chat_channel_id: 4,
        status: "archived",
      });
      await settled();
      assert.strictEqual(
        query(
          ".chat-channel-title-with-status .chat-channel-status"
        ).innerText.trim(),
        I18n.t("chat.channel_status.archived_header"),
        "channel status changes to archived"
      );
    });
  }
);
