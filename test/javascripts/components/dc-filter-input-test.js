import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import { discourseModule, exists } from "discourse/tests/helpers/qunit-helpers";
import hbs from "htmlbars-inline-precompile";
import { fillIn, render, triggerEvent } from "@ember/test-helpers";
import { test } from "qunit";

discourseModule(
  "Discourse Chat | Component | dc-filter-input",
  function (hooks) {
    setupRenderingTest(hooks);

    test("Left icon", async function (assert) {
      await render(hbs`<DcFilterInput @icons={{hash left="bell"}} />`);

      assert.ok(exists(".d-icon-bell.-left"));
    });

    test("Right icon", async function (assert) {
      await render(hbs`<DcFilterInput @icons={{hash right="bell"}} />`);

      assert.ok(exists(".d-icon-bell.-right"));
    });

    test("Class attribute", async function (assert) {
      await render(hbs`<DcFilterInput @class="foo" />`);

      assert.ok(exists(".dc-filter-input-container.foo"));
    });

    test("Html attributes", async function (assert) {
      await render(hbs`<DcFilterInput data-foo="1" placeholder="bar" />`);

      assert.ok(exists('.dc-filter-input[data-foo="1"]'));
      assert.ok(exists('.dc-filter-input[placeholder="bar"]'));
    });

    test("Filter action", async function (assert) {
      this.set("value", null);
      this.set("action", (event) => {
        this.set("value", event.target.value);
      });
      await render(hbs`<DcFilterInput @filterAction={{this.action}} />`);
      await fillIn(".dc-filter-input", "foo");

      assert.equal(this.value, "foo");
    });

    test("Focused state", async function (assert) {
      await render(hbs`<DcFilterInput @filterAction={{this.action}} />`);
      await triggerEvent(".dc-filter-input", "focus");

      assert.ok(exists(".dc-filter-input-container.is-focused"));

      await triggerEvent(".dc-filter-input", "blur");

      assert.notOk(exists(".dc-filter-input-container.is-focused"));
    });
  }
);
