import selectKit from "discourse/tests/helpers/select-kit-helper";
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

  const catsCategory = {
    id: 1,
    name: "Cats",
    slug: "cats",
    permission: 1,
  };

  needs.site({
    categories: [
      catsCategory,
      {
        id: 2,
        name: maliciousText,
        slug: maliciousText,
        permission: 1,
      },
      {
        id: 3,
        name: "Kittens",
        slug: "kittens",
        permission: 1,
        parentCategory: catsCategory,
      },
    ],
  });

  needs.pretender((server, helper) => {
    server.get("/chat/:chatChannelId/messages.json", () =>
      helper.response({
        meta: { can_chat: true, user_silenced: false },
        chat_messages: [],
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

    server.get(
      "/chat/api/category-chatables/:categoryId/permissions.json",
      () => helper.response(["@awesomeGroup"])
    );
  });

  test("links to categories and selected category's security settings", async function (assert) {
    await visit("/chat/channel/1/cat");

    const dropdown = selectKit(".edit-channels-dropdown");
    await dropdown.expand();
    await dropdown.selectRowByValue("openCreateChannelModal");

    assert.strictEqual(
      query(".create-channel-hint a").innerText,
      "category security settings"
    );
    assert.ok(query(".create-channel-hint a").href.includes("/categories"));

    let categories = selectKit(".create-channel-modal .category-chooser");
    await categories.expand();
    await categories.selectRowByName("Cats");

    assert.strictEqual(
      query(".create-channel-hint a").innerText,
      "security settings"
    );
    assert.ok(
      query(".create-channel-hint a").href.includes("/c/cats/edit/security")
    );
  });

  test("links to selected category's security settings works with nested subcategories", async function (assert) {
    await visit("/chat/channel/1/cat");

    const dropdown = selectKit(".edit-channels-dropdown");
    await dropdown.expand();
    await dropdown.selectRowByValue("openCreateChannelModal");

    assert.strictEqual(
      query(".create-channel-hint a").innerText,
      "category security settings"
    );
    assert.ok(query(".create-channel-hint a").href.includes("/categories"));

    let categories = selectKit(".create-channel-modal .category-chooser");
    await categories.expand();
    await categories.selectRowByName("Kittens");

    assert.strictEqual(
      query(".create-channel-hint a").innerText,
      "security settings"
    );
    assert.ok(
      query(".create-channel-hint a").href.includes(
        "/c/cats/kittens/edit/security"
      )
    );
  });

  test("links to categories are escaped", async (assert) => {
    await visit("/chat/channel/1/cat");

    const dropdown = selectKit(".edit-channels-dropdown");
    await dropdown.expand();
    await dropdown.selectRowByValue("openCreateChannelModal");

    let categories = selectKit(".create-channel-modal .category-chooser");
    await categories.expand();
    await categories.selectRowByName(maliciousText);

    assert.strictEqual(
      query(".create-channel-hint a").innerText,
      "security settings"
    );
    assert.ok(
      query(".create-channel-hint a").href.includes(
        "c/%3Cscript%3E%3C/script%3E/edit/security"
      )
    );
  });

  test("includes group names in the hint", async (assert) => {
    await visit("/chat/channel/1/cat");

    const dropdown = selectKit(".edit-channels-dropdown");
    await dropdown.expand();
    await dropdown.selectRowByValue("openCreateChannelModal");

    assert.strictEqual(
      query(".create-channel-hint a").innerText,
      "category security settings"
    );
    assert.ok(query(".create-channel-hint a").href.includes("/categories"));

    let categories = selectKit(".create-channel-modal .category-chooser");
    await categories.expand();
    await categories.selectRowByName("Kittens");

    assert.strictEqual(
      query(".create-channel-hint").innerText,
      "Users in @awesomeGroup will have access to this channel per the security settings"
    );
  });
});
