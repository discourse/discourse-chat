import { visit } from "@ember/test-helpers";
import { acceptance, query } from "discourse/tests/helpers/qunit-helpers";
import { test } from "qunit";

acceptance("Discourse Chat - Create channel modal", function (needs) {
  const maliciousText = "<script></script>";

  needs.user({
    username: "tomtom",
    id: 1,
    can_chat: true,
    has_chat_enabled: true,
  });

  needs.settings({
    chat_enabled: true,
  });

  needs.site({
    categories: [
      {
        id: 1,
        name: "Cats",
        slug: "cats",
        permission: 1,
      },
      {
        id: 2,
        name: maliciousText,
        slug: maliciousText,
        permission: 1,
      },
    ],
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
      query(".create-channel-hint a").innerText,
      "category security settings"
    );
    assert.ok(query(".create-channel-hint a").href.includes("/categories"));

    await click(".category-chooser .select-kit-header-wrapper");
    await click(".category-chooser .select-kit-body li[title='Cats']");

    assert.strictEqual(
      query(".create-channel-hint a").innerText,
      "Cats security settings"
    );
    assert.ok(
      query(".create-channel-hint a").href.includes("/c/cats/edit/security")
    );
  });

  test("links to categories are escaped", async (assert) => {
    await visit("/chat/channel/1/cat");

    await click(".edit-channels-dropdown .select-kit-header-wrapper");
    await click("li[data-value='openCreateChannelModal']");

    await click(".category-chooser .select-kit-header-wrapper");
    await click(
      `.category-chooser .select-kit-body li[title='${maliciousText}']`
    );

    assert.strictEqual(
      query(".create-channel-hint a").innerText,
      "<script></script> security settings"
    );
    assert.ok(
      query(".create-channel-hint a").href.includes(
        "c/%3Cscript%3E%3C/script%3E/edit/security"
      )
    );
  });
});
