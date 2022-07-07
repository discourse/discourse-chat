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
import I18n from "I18n";

discourseModule(
  "Discourse Chat | Component | chat-channel-about-view | admin user",
  function (hooks) {
    setupRenderingTest(hooks);

    hooks.beforeEach(function () {
      this.set(
        "channel",
        fabricate("chat-channel", { chatable_type: "Category" })
      );
      this.channel.set("description", "foo");
      this.currentUser.set("admin", true);
      this.currentUser.set("has_chat_enabled", true);
      this.siteSettings.chat_enabled = true;
    });

    test("chatable name", async function (assert) {
      await render(hbs`{{chat-channel-about-view channel=channel}}`);

      assert.equal(
        query(".category-name").innerText,
        this.channel.chatable.name
      );
    });

    test("chatable description", async function (assert) {
      await render(hbs`{{chat-channel-about-view channel=channel}}`);

      assert.equal(
        query(".category-name").innerText,
        this.channel.chatable.name
      );

      this.channel.set("description", null);
      await settled();

      assert.equal(
        query(".channel-info-about-view__description__helper-text").innerText,
        I18n.t("chat.channel_edit_description_modal.description")
      );
    });

    test("edit title", async function (assert) {
      await render(hbs`{{chat-channel-about-view channel=channel}}`);

      assert.ok(exists(".edit-title-btn"));
    });

    test("edit description", async function (assert) {
      await render(hbs`{{chat-channel-about-view channel=channel}}`);

      assert.ok(exists(".edit-description-btn"));
    });

    test("join", async function (assert) {
      await render(hbs`{{chat-channel-about-view channel=channel}}`);

      assert.ok(exists(".join-channel-btn"));
    });

    test("leave", async function (assert) {
      this.channel.set("following", true);
      await render(hbs`{{chat-channel-about-view channel=channel}}`);

      assert.ok(exists(".leave-channel-btn"));
    });
  }
);

discourseModule(
  "Discourse Chat | Component | chat-channel-about-view | regular user",
  function (hooks) {
    setupRenderingTest(hooks);

    hooks.beforeEach(function () {
      this.set(
        "channel",
        fabricate("chat-channel", { chatable_type: "Category" })
      );
      this.channel.set("description", "foo");
      this.currentUser.set("has_chat_enabled", true);
      this.siteSettings.chat_enabled = true;
    });

    test("chatable name", async function (assert) {
      await render(hbs`{{chat-channel-about-view channel=channel}}`);

      assert.equal(
        query(".category-name").innerText,
        this.channel.chatable.name
      );
    });

    test("chatable description", async function (assert) {
      await render(hbs`{{chat-channel-about-view channel=channel}}`);

      assert.equal(
        query(".category-name").innerText,
        this.channel.chatable.name
      );

      this.channel.set("description", null);
      await settled();

      assert.notOk(exists(".channel-info-about-view__description"));
    });

    test("edit title", async function (assert) {
      await render(hbs`{{chat-channel-about-view channel=channel}}`);

      assert.notOk(exists(".edit-title-btn"));
    });

    test("edit description", async function (assert) {
      await render(hbs`{{chat-channel-about-view channel=channel}}`);

      assert.notOk(exists(".edit-description-btn"));
    });

    test("join", async function (assert) {
      await render(hbs`{{chat-channel-about-view channel=channel}}`);

      assert.ok(exists(".join-channel-btn"));
    });

    test("leave", async function (assert) {
      this.channel.set("following", true);
      await render(hbs`{{chat-channel-about-view channel=channel}}`);

      assert.ok(exists(".leave-channel-btn"));
    });
  }
);
