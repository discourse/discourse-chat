import componentTest, {
  setupRenderingTest,
} from "discourse/tests/helpers/component-test";
import { discourseModule, exists } from "discourse/tests/helpers/qunit-helpers";
import hbs from "htmlbars-inline-precompile";
import fabricate from "../helpers/fabricators";

discourseModule(
  "Discourse Chat | Component | chat-channel-row",
  function (hooks) {
    setupRenderingTest(hooks);

    componentTest("with leaveButton", {
      template: hbs`{{chat-channel-row channel=channel options=(hash leaveButton=true)}}`,

      beforeEach() {
        this.set("channel", fabricate("chat-channel"));
      },

      async test(assert) {
        assert.ok(exists(".chat-channel-leave-btn"));
      },
    });

    componentTest("without leaveButton", {
      template: hbs`{{chat-channel-row channel=channel}}`,

      beforeEach() {
        this.set("channel", fabricate("chat-channel"));
      },

      async test(assert) {
        assert.notOk(exists(".chat-channel-leave-btn"));
      },
    });
  }
);
