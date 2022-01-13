import componentTest, {
  setupRenderingTest,
} from "discourse/tests/helpers/component-test";
import { discourseModule, exists } from "discourse/tests/helpers/qunit-helpers";
import hbs from "htmlbars-inline-precompile";

discourseModule(
  "Discourse Chat | Widget | topic-title-chat-link",
  function (hooks) {
    setupRenderingTest(hooks);

    componentTest("topic is closed", {
      template: hbs`{{mount-widget widget="topic-title-chat-link" args=args}}`,
      beforeEach() {
        this.set("args", { closed: true });
      },
      test(assert) {
        assert.notOk(exists(".d-icon-far-comments"));
      },
    });

    componentTest("topic is opened", {
      template: hbs`{{mount-widget widget="topic-title-chat-link" args=args}}`,
      beforeEach() {
        this.set("args", { closed: false });
      },
      test(assert) {
        assert.ok(exists(".d-icon-far-comments"));
      },
    });
  }
);
