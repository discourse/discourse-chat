import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import { exists } from "discourse/tests/helpers/qunit-helpers";
import hbs from "htmlbars-inline-precompile";
import { tap, render, settled } from "@ember/test-helpers";
import { module, test } from "qunit";

module(
  "Discourse Chat | Component | chat-message-actions-mobile",
  function (hooks) {
    setupRenderingTest(hooks);

    hooks.beforeEach(function () {
      this.site.mobileView = true;
    });

    test("when closing menu", async function (assert) {
      await render(hbs`{{chat-message-actions-mobile}}`);

      assert.ok(exists(".chat-msgactions-backdrop"));

      await tap(".collapse-area");

      assert.notOk(exists(".chat-msgactions-backdrop"));
    });
  }
);
