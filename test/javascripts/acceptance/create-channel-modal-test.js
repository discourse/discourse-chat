import { visit } from "@ember/test-helpers";
import { acceptance, query } from "discourse/tests/helpers/qunit-helpers";
import { test } from "qunit";

acceptance("Discourse Chat - Create channel modal", function (needs) {
  needs.user({
    username: "tomtom",
    id: 1,
    can_chat: true,
    has_chat_enabled: true,
  });
  needs.settings({
    chat_enabled: true,
  });
  needs.pretender((server, helper) => {
    server.get("/chat/:chatChannelId/messages.json", () =>
      helper.response({ chat_messages: [] })
    );

    server.get("/chat/chat_channels.json", () =>
      helper.response({
        public_channels: [],
        direct_message_channels: [],
      })
    );

    server.get("/chat/chat_channels/:chatChannelId", () =>
      helper.response({ chat_channel: { id: 1 } })
    );
  });

  test("links to categories and selected category's security settings", async function (assert) {
    await visit("/chat/channel/1/cat");

    await click(".edit-channels-dropdown .select-kit-header-wrapper");
    await click("li[data-value='openCreateChannelModal']");

    assert.strictEqual(
      query(".create-channel-label a").innerText,
      "category security settings"
    );
    assert.ok(query(".create-channel-label a").href.includes("/categories"));

    await click(".category-chooser .select-kit-header-wrapper");
    await click(".category-chooser .select-kit-body li[title='support']");

    assert.strictEqual(
      query(".create-channel-label a").innerText,
      "support security settings"
    );
    assert.ok(
      query(".create-channel-label a").href.includes("/c/support/edit/security")
    );
  });
});
