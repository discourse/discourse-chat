import {
  acceptance,
  query,
  queryAll,
} from "discourse/tests/helpers/qunit-helpers";
import { click, currentURL, fillIn, visit } from "@ember/test-helpers";
import { test } from "qunit";
import I18n from "I18n";
import fabricate from "../helpers/fabricators";
import { isEmpty } from "@ember/utils";

acceptance("Discourse Chat - browse channels", function (needs) {
  needs.user({ has_chat_enabled: true, can_chat: true });

  needs.settings({ chat_enabled: true });

  needs.pretender((server, helper) => {
    // we don't need anything in the sidebar for this test
    server.get("/chat/chat_channels.json", () => {
      return helper.response({
        public_channels: [],
        direct_message_channels: [],
      });
    });

    server.get("/chat/api/chat_channels.json", (request) => {
      const params = request.queryParams;

      if (!isEmpty(params.filter)) {
        if (params.filter === "foo") {
          return helper.response([fabricate("chat-channel")]);
        } else {
          return helper.response([]);
        }
      }

      const channels = [];
      if (isEmpty(params.status) || params.status === "open") {
        channels.push(fabricate("chat-channel"));
        channels.push(fabricate("chat-channel"));
      }

      if (params.status === "closed" || isEmpty(params.status)) {
        channels.push(fabricate("chat-channel", { status: "closed" }));
      }

      if (params.status === "archived" || isEmpty(params.status)) {
        channels.push(fabricate("chat-channel", { status: "archived" }));
      }

      return helper.response(channels);
    });
  });

  test("Defaults to open filter", async function (assert) {
    await visit("/chat/browse");
    assert.equal(currentURL(), "/chat/browse/open");
  });

  test("All filter", async function (assert) {
    await visit("/chat/browse");
    await click(".chat-browse-view__filter-link.-all");

    assert.equal(currentURL(), "/chat/browse/all");
    assert.equal(queryAll(".chat-channel-card").length, 4);
  });

  test("Open filter", async function (assert) {
    await visit("/chat/browse");
    await click(".chat-browse-view__filter-link.-open");

    assert.equal(currentURL(), "/chat/browse/open");
    assert.equal(queryAll(".chat-channel-card").length, 2);
  });

  test("Closed filter", async function (assert) {
    await visit("/chat/browse");
    await click(".chat-browse-view__filter-link.-closed");

    assert.equal(currentURL(), "/chat/browse/closed");
    assert.equal(queryAll(".chat-channel-card").length, 1);
  });

  test("Archived filter", async function (assert) {
    await visit("/chat/browse");
    await click(".chat-browse-view__filter-link.-archived");

    assert.equal(currentURL(), "/chat/browse/archived");
    assert.equal(queryAll(".chat-channel-card").length, 1);
  });

  test("Filtering results", async function (assert) {
    await visit("/chat/browse");

    assert.equal(queryAll(".chat-channel-card").length, 2);

    await fillIn(".dc-filter-input", "foo");

    assert.equal(queryAll(".chat-channel-card").length, 1);
  });

  test("No results", async function (assert) {
    await visit("/chat/browse");
    await fillIn(".dc-filter-input", "bar");

    assert.equal(
      query(".empty-state-title").innerText.trim(),
      I18n.t("chat.empty_state.title")
    );
  });
});
