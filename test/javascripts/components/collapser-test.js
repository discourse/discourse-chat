import componentTest, {
  setupRenderingTest,
} from "discourse/tests/helpers/component-test";
import hbs from "htmlbars-inline-precompile";
import {
  discourseModule,
  exists,
  query,
} from "discourse/tests/helpers/qunit-helpers";

discourseModule("Discourse chat | Component | collapser", function (hooks) {
  setupRenderingTest(hooks);

  componentTest("renders header", {
    template: hbs`{{collapser header=header}}`,

    beforeEach() {
      this.set("header", "<div class='cat'>tomtom</div>");
    },

    async test(assert) {
      const element = query(".cat");

      assert.ok(exists(element));
    },
  });

  componentTest("collapses and expands yielded body", {
    template: hbs`{{#collapser}}<div class='cat'>body text</div>{{/collapser}}`,

    test: async function (assert) {
      const openButton = ".chat-message-collapser-closed";
      const closeButton = ".chat-message-collapser-opened";
      const body = ".cat";

      assert.ok(exists(body));
      await click(closeButton);

      assert.notOk(exists(body));

      await click(openButton);

      assert.ok(exists(body));
    },
  });
});
