import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import {
  discourseModule,
  exists,
  query,
} from "discourse/tests/helpers/qunit-helpers";
import hbs from "htmlbars-inline-precompile";
import fabricate from "../helpers/fabricators";
import { render, settled } from "@ember/test-helpers";
import { test } from "qunit";

discourseModule(
  "Discourse Chat | Component | chat-channel-preview-card",
  function (hooks) {
    setupRenderingTest(hooks);

    hooks.beforeEach(function () {
      this.set(
        "channel",
        fabricate("chat-channel", { chatable_type: "Category" })
      );
      this.channel.setProperties({
        description: "Important stuff is announced here.",
        title: "announcements",
      });
      this.channel.chatable.color = "800080";
      this.currentUser.set("has_chat_enabled", true);
      this.siteSettings.chat_enabled = true;
    });

    test("channel title", async function (assert) {
      await render(hbs`{{chat-channel-preview-card channel=channel}}`);

      assert.equal(
        query(".chat-channel-title__name").innerText,
        this.channel.title,
        "it shows the channel title"
      );

      assert.ok(
        exists(query(".chat-channel-title__category-badge")),
        "it shows the category hashtag badge"
      );
    });

    test("channel description", async function (assert) {
      await render(hbs`{{chat-channel-preview-card channel=channel}}`);

      assert.equal(
        query(".chat-channel-preview-card__description").innerText,
        this.channel.description,
        "the channel description is shown"
      );
    });

    test("no channel description", async function (assert) {
      this.channel.set("description", null);

      await render(hbs`{{chat-channel-preview-card channel=channel}}`);

      assert.notOk(
        exists(".chat-channel-preview-card__description"),
        "no line is left for the channel description if there is none"
      );

      assert.ok(
        exists(".chat-channel-preview-card--no-description"),
        "it adds a modifier class for styling"
      );
    });

    test("join", async function (assert) {
      await render(hbs`{{chat-channel-preview-card channel=channel}}`);

      assert.ok(
        exists(".chat-channel-preview-card__join-channel-btn"),
        "it shows the join channel button"
      );
    });

    test("browse all", async function (assert) {
      await render(hbs`{{chat-channel-preview-card channel=channel}}`);

      assert.ok(
        exists(".chat-channel-preview-card__browse-all"),
        "it shows a link to browse all channels"
      );
    });
  }
);
