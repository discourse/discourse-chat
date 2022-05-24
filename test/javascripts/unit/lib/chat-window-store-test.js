import { discourseModule } from "discourse/tests/helpers/qunit-helpers";
import { test } from "qunit";

discourseModule(
  "Discourse Chat | Unit | chat-window-store",
  function (hooks) {
    hooks.beforeEach(function () {
      this.chatWindowStore = this.container.lookup(
        "service:chat-window-store"
      );
    });

    test("defaults", function (assert) {
      assert.strictEqual(this.chatWindowStore.fullPage, false);
    });

    test("fullPage", function (assert) {
      this.chatWindowStore.set("fullPage", true);
      assert.strictEqual(this.chatWindowStore.fullPage, true);
    });

    test("fullPageFalse", function (assert) {
      this.chatWindowStore.set("fullPage", false);
      assert.strictEqual(this.chatWindowStore.fullPage, false);
    });

    test("fullPageNull", function (assert) {
      this.chatWindowStore.set("fullPage", null);
      assert.strictEqual(this.chatWindowStore.fullPage, false);
    });
  }
);
