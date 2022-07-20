import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import {
  discourseModule,
  exists,
  query,
} from "discourse/tests/helpers/qunit-helpers";
import hbs from "htmlbars-inline-precompile";
import fabricators from "../helpers/fabricators";
import { render } from "@ember/test-helpers";
import { test } from "qunit";
import I18n from "I18n";

discourseModule(
  "Discourse Chat | Component | chat-channel-card",
  function (hooks) {
    setupRenderingTest(hooks);

    hooks.beforeEach(function () {
      this.set("channel", fabricators.chatChannel());
      this.channel.set(
        "description",
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
      );
    });

    test("Closed channel", async function (assert) {
      this.channel.set("status", "closed");
      await render(hbs`{{chat-channel-card channel=channel}}`);

      assert.ok(exists(".chat-channel-card.-closed"));
    });

    test("Archived channel", async function (assert) {
      this.channel.set("status", "archived");
      await render(hbs`{{chat-channel-card channel=channel}}`);

      assert.ok(exists(".chat-channel-card.-archived"));
    });

    test("Muted channel", async function (assert) {
      this.channel.set("muted", true);
      this.channel.set("following", true);
      await render(hbs`{{chat-channel-card channel=channel}}`);

      assert.equal(
        query(".chat-channel-card__tag.-muted").innerText.trim(),
        I18n.t("chat.muted")
      );
    });

    test("Joined channel", async function (assert) {
      this.channel.set("following", true);
      await render(hbs`{{chat-channel-card channel=channel}}`);

      assert.equal(
        query(".chat-channel-card__tag.-joined").innerText.trim(),
        I18n.t("chat.joined")
      );
    });

    test("Joinable channel", async function (assert) {
      await render(hbs`{{chat-channel-card channel=channel}}`);

      assert.ok(exists(".chat-channel-card__join-btn"));
    });

    test("Memberships count", async function (assert) {
      this.channel.set("memberships_count", 4);
      await render(hbs`{{chat-channel-card channel=channel}}`);

      assert.equal(
        query(".chat-channel-card__members").innerText.trim(),
        I18n.t("chat.channel.memberships_count", { count: 4 })
      );
    });

    test("No description", async function (assert) {
      this.channel.set("description", null);
      await render(hbs`{{chat-channel-card channel=channel}}`);

      assert.notOk(exists(".chat-channel-card__description"));
    });

    test("Description", async function (assert) {
      await render(hbs`{{chat-channel-card channel=channel}}`);

      assert.equal(
        query(".chat-channel-card__description").innerText.trim(),
        this.channel.description
      );
    });

    test("Name", async function (assert) {
      await render(hbs`{{chat-channel-card channel=channel}}`);

      assert.equal(
        query(".chat-channel-card__name").innerText.trim(),
        this.channel.title
      );
    });

    test("Settings button", async function (assert) {
      await render(hbs`{{chat-channel-card channel=channel}}`);

      assert.ok(exists(".chat-channel-card__setting"));
    });

    test("Read restricted chatable", async function (assert) {
      this.channel.set("chatable.read_restricted", true);
      await render(hbs`{{chat-channel-card channel=channel}}`);

      assert.ok(exists(".d-icon-lock"));
      assert.equal(
        query(".chat-channel-card").style.borderLeftColor,
        "rgb(213, 99, 83)"
      );
    });
  }
);
