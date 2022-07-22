import {
  acceptance,
  exists,
  query,
  queryAll,
} from "discourse/tests/helpers/qunit-helpers";
import { test } from "qunit";
import { visit } from "@ember/test-helpers";
import { directMessageChannels } from "discourse/plugins/discourse-chat/chat-fixtures";
import { cloneJSON } from "discourse-common/lib/object";
import I18n from "I18n";

acceptance("Discourse Chat - Core Sidebar", function (needs) {
  needs.user({ experimental_sidebar_enabled: true, has_chat_enabled: true });

  needs.settings({
    chat_enabled: true,
    enable_experimental_sidebar: true,
  });

  needs.pretender((server, helper) => {
    let directChannels = cloneJSON(directMessageChannels).mapBy("chat_channel");
    directChannels[0].chatable.users = [directChannels[0].chatable.users[0]];
    directChannels[0].unread_count = 1;

    server.get("/chat/chat_channels.json", () => {
      return helper.response({
        public_channels: [
          {
            id: 1,
            title: "dev",
            unread_count: 0,
            unread_mentions: 0,
            chatable_type: "Category",
            chatable: { slug: "dev", read_restricted: true },
          },
          {
            id: 2,
            title: "general",
            unread_count: 1,
            unread_mentions: 0,
            chatable_type: "Category",
            chatable: { slug: "general" },
          },
          {
            id: 3,
            title: "random",
            unread_count: 1,
            unread_mentions: 1,
            chatable_type: "Category",
            chatable: { slug: "random" },
          },
        ],
        direct_message_channels: directChannels,
      });
    });
  });

  test("Public channels section", async function (assert) {
    await visit("/");

    assert.strictEqual(
      query(
        ".sidebar-section-chat-channels .sidebar-section-header-text"
      ).textContent.trim(),
      I18n.t("chat.chat_channels"),
      "displays correct channels section title"
    );

    assert.ok(
      exists(
        ".sidebar-section-chat-channels .sidebar-section-link-dev .sidebar-section-link-prefix svg.prefix-icon.d-icon-hashtag"
      ),
      "dev channel section link displays hash icon prefix"
    );

    assert.ok(
      exists(
        ".sidebar-section-chat-channels .sidebar-section-link-dev .sidebar-section-link-prefix svg.prefix-badge.d-icon-lock"
      ),
      "dev channel section link displays lock badge for restricted channel"
    );

    assert.strictEqual(
      query(
        ".sidebar-section-chat-channels .sidebar-section-link-dev"
      ).textContent.trim(),
      "dev",
      "dev channel section link displays channel title in the link"
    );

    assert.ok(
      query(
        ".sidebar-section-chat-channels .sidebar-section-link-dev"
      ).href.endsWith("/chat/channel/1/dev"),
      "dev channel section link has the right href attribute"
    );

    assert.notOk(
      exists(
        ".sidebar-section-chat-channels .sidebar-section-link-dev .sidebar-section-link-suffix"
      ),
      "does not display new messages indicator"
    );

    assert.ok(
      exists(
        ".sidebar-section-chat-channels .sidebar-section-link-general .sidebar-section-link-prefix svg.prefix-icon.d-icon-hashtag"
      ),
      "general channel section link displays hash icon prefix"
    );

    assert.notOk(
      exists(
        ".sidebar-section-chat-channels .sidebar-section-link-general .sidebar-section-link-prefix svg.prefix-badge"
      ),
      "general channel section link does not display lock badge for public channel"
    );

    assert.strictEqual(
      query(
        ".sidebar-section-chat-channels .sidebar-section-link-general"
      ).textContent.trim(),
      "general",
      "general channel section link displays channel title in the link"
    );

    assert.ok(
      exists(
        ".sidebar-section-chat-channels .sidebar-section-link-general .sidebar-section-link-suffix.unread"
      ),
      "general section link has new messages indicator"
    );

    assert.ok(
      exists(
        ".sidebar-section-chat-channels .sidebar-section-link-random .sidebar-section-link-prefix svg.prefix-icon.d-icon-hashtag"
      ),
      "random channel section link displays hash icon prefix"
    );

    assert.strictEqual(
      query(
        ".sidebar-section-chat-channels .sidebar-section-link-random"
      ).textContent.trim(),
      "random",
      "random channel section link displays channel title in the link"
    );

    assert.ok(
      exists(
        ".sidebar-section-chat-channels .sidebar-section-link-random .sidebar-section-link-suffix.urgent"
      ),
      "random section link has new messages mention indicator"
    );
  });

  test("Direct messages section", async function (assert) {
    await visit("/");

    assert.strictEqual(
      query(
        ".sidebar-section-chat-dms .sidebar-section-header-text"
      ).textContent.trim(),
      I18n.t("chat.direct_messages.title"),
      "displays correct direct messages section title"
    );

    const directLinks = queryAll(
      ".sidebar-section-chat-dms a.sidebar-section-link"
    );

    assert.strictEqual(
      directLinks
        .eq(0)
        .find(".sidebar-section-link-prefix img")[0]
        .classList.contains("prefix-image"),
      true,
      "displays avatar in prefix when two participants"
    );

    assert.strictEqual(
      directLinks[0].textContent.trim(),
      "hawk",
      "displays user name in a link"
    );

    assert.strictEqual(
      directLinks
        .eq(0)
        .find(".sidebar-section-link-suffix")[0]
        .classList.contains("urgent"),
      true,
      "displays new messages indicator"
    );

    assert.strictEqual(
      directLinks
        .eq(1)
        .find("span.sidebar-section-link-prefix")[0]
        .classList.contains("text"),
      true,
      "displays text in prefix when more than two participants"
    );

    assert.strictEqual(
      directLinks
        .eq(1)
        .find(".sidebar-section-link-content-text")[0]
        .textContent.trim(),
      "eviltrout, markvanlan",
      "displays all participants name in a link"
    );

    assert.ok(
      !exists(directLinks.eq(1).find(".sidebar-section-link-suffix")[0]),
      "does not display new messages indicator"
    );
  });
});
