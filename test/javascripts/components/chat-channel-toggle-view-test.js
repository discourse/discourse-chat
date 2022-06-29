import componentTest, {
  setupRenderingTest,
} from "discourse/tests/helpers/component-test";
import { discourseModule, query } from "discourse/tests/helpers/qunit-helpers";
import { click } from "@ember/test-helpers";
import hbs from "htmlbars-inline-precompile";
import fabricate from "../helpers/fabricators";
import I18n from "I18n";
import pretender from "discourse/tests/helpers/create-pretender";

discourseModule(
  "Discourse Chat | Component | chat-channel-toggle-view | closed channel",
  function (hooks) {
    setupRenderingTest(hooks);

    componentTest("texts", {
      template: hbs`{{chat-channel-toggle-view channel=channel}}`,

      beforeEach() {
        this.set("channel", fabricate("chat-channel", { status: "closed" }));
      },

      async test(assert) {
        assert.equal(
          query("#chat-channel-toggle").innerText.trim(),
          I18n.t("chat.channel_open.instructions")
        );
        assert.equal(
          query("#chat-channel-toggle-btn").innerText.trim(),
          I18n.t("chat.channel_settings.open_channel")
        );
      },
    });

    componentTest("action", {
      template: hbs`{{chat-channel-toggle-view channel=channel}}`,

      beforeEach() {
        this.set("channel", fabricate("chat-channel", { status: "closed" }));
      },

      async test(assert) {
        pretender.put(
          `/chat/chat_channels/${this.channel.id}/change_status.json`,
          () => {
            return [200, { "Content-Type": "application/json" }, {}];
          }
        );

        await click("#chat-channel-toggle-btn");

        assert.equal(this.channel.isClosed, false);
      },
    });
  }
);

discourseModule(
  "Discourse Chat | Component | chat-channel-toggle-view | opened channel",
  function (hooks) {
    setupRenderingTest(hooks);

    componentTest("texts", {
      template: hbs`{{chat-channel-toggle-view channel=channel}}`,

      beforeEach() {
        this.set("channel", fabricate("chat-channel", { status: "open" }));
      },

      async test(assert) {
        assert.equal(
          query("#chat-channel-toggle").innerText.trim(),
          I18n.t("chat.channel_close.instructions")
        );
        assert.equal(
          query("#chat-channel-toggle-btn").innerText.trim(),
          I18n.t("chat.channel_settings.close_channel")
        );
      },
    });

    componentTest("action", {
      template: hbs`{{chat-channel-toggle-view channel=channel}}`,

      beforeEach() {
        this.set("channel", fabricate("chat-channel", { status: "open" }));
      },

      async test(assert) {
        pretender.put(
          `/chat/chat_channels/${this.channel.id}/change_status.json`,
          () => {
            return [200, { "Content-Type": "application/json" }, {}];
          }
        );

        await click("#chat-channel-toggle-btn");

        assert.equal(this.channel.isClosed, true);
      },
    });
  }
);
