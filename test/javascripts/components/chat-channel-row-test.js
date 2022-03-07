import componentTest, {
  setupRenderingTest,
} from "discourse/tests/helpers/component-test";
import { discourseModule, exists } from "discourse/tests/helpers/qunit-helpers";
import hbs from "htmlbars-inline-precompile";
import fabricate from "../helpers/fabricators";
import { click, triggerKeyEvent } from "@ember/test-helpers";

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

    componentTest("receives click", {
      template: hbs`{{chat-channel-row switchChannel=switchChannel channel=channel}}`,

      beforeEach() {
        this.set("switchedChannel", null);
        this.set("channel", fabricate("chat-channel"));
        this.set("switchChannel", (channel) =>
          this.set("switchedChannel", channel.id)
        );
      },

      async test(assert) {
        await click(".chat-channel-row");

        assert.strictEqual(this.switchedChannel, this.channel.id);
      },
    });

    componentTest("receives Enter keyup", {
      template: hbs`{{chat-channel-row switchChannel=switchChannel channel=channel}}`,

      beforeEach() {
        this.set("switchedChannel", null);
        this.set("channel", fabricate("chat-channel"));
        this.set("switchChannel", (channel) =>
          this.set("switchedChannel", channel.id)
        );
      },

      async test(assert) {
        await triggerKeyEvent(".chat-channel-row", "keyup", 13);

        assert.strictEqual(this.switchedChannel, this.channel.id);
      },
    });

    componentTest("can receive a tab event", {
      template: hbs`{{chat-channel-row channel=channel}}`,

      beforeEach() {
        this.set("channel", fabricate("chat-channel"));
      },

      async test(assert) {
        assert.ok(exists(".chat-channel-row[tabindex=0]"));
      },
    });
  }
);
