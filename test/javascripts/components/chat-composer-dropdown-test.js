import componentTest, {
  setupRenderingTest,
} from "discourse/tests/helpers/component-test";
import { discourseModule, exists } from "discourse/tests/helpers/qunit-helpers";
import hbs from "htmlbars-inline-precompile";
import { click } from "@ember/test-helpers";

discourseModule(
  "Discourse Chat | Component | chat-composer-dropdown",
  function (hooks) {
    setupRenderingTest(hooks);

    componentTest("buttons", {
      template: hbs`{{chat-composer-dropdown buttons=buttons}}`,

      async beforeEach() {
        this.set("buttons", [{ id: "foo", icon: "times", action: () => {} }]);
      },

      async test(assert) {
        await click(".chat-composer-dropdown__trigger-btn");

        assert.ok(exists(".chat-composer-dropdown__list__item.foo"));
        assert.ok(
          exists(".chat-composer-dropdown__list__item.foo .d-icon-times")
        );
      },
    });
  }
);
