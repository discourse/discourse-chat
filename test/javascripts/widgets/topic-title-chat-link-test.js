import componentTest, {
  setupRenderingTest,
} from "discourse/tests/helpers/component-test";
import { discourseModule, exists } from "discourse/tests/helpers/qunit-helpers";
import hbs from "htmlbars-inline-precompile";

discourseModule(
  "Discourse Chat | Widgets | topic-title-chat-link",
  function (hooks) {
    setupRenderingTest(hooks);

    componentTest("topic is opened", {
      template: hbs`{{mount-widget widget="topic-title-chat-link" args=args}}`,

      async beforeEach() {
        this.set("args", { closed: false, has_chat_live: true });
      },

      async test(assert) {
        assert.ok(exists(".topic-title-chat-link:not(.hidden)"));
      },
    });

    componentTest("topic is closed", {
      template: hbs`{{mount-widget widget="topic-title-chat-link" args=args}}`,

      async beforeEach() {
        this.set("args", { closed: true, has_chat_live: true });
      },

      async test(assert) {
        assert.ok(exists(".topic-title-chat-link.hidden"));
      },
    });

    componentTest("topic doesn’t have chat", {
      template: hbs`{{mount-widget widget="topic-title-chat-link" args=args}}`,

      async beforeEach() {
        this.set("args", { closed: false, has_chat_live: false });
      },

      async test(assert) {
        assert.ok(exists(".topic-title-chat-link.hidden"));
      },
    });
  }
);
