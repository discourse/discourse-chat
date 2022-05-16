import componentTest, {
  setupRenderingTest,
} from "discourse/tests/helpers/component-test";
import hbs from "htmlbars-inline-precompile";
import {
  discourseModule,
  exists,
  query,
} from "discourse/tests/helpers/qunit-helpers";
import I18n from "I18n";

discourseModule(
  "Discourse Chat | Component | chat-message-info",
  function (hooks) {
    setupRenderingTest(hooks);

    componentTest("chat_webhook_event", {
      template: hbs`{{chat-message-info message=message}}`,

      beforeEach() {
        this.set("message", { chat_webhook_event: { username: "discobot" } });
      },

      async test(assert) {
        assert.equal(
          query(".chat-message-info__username").innerText.trim(),
          this.message.chat_webhook_event.username
        );
        assert.equal(
          query(".chat-message-info__bot-indicator").innerText.trim(),
          I18n.t("chat.bot")
        );
      },
    });

    componentTest("user", {
      template: hbs`{{chat-message-info message=message}}`,

      beforeEach() {
        this.set("message", { user: { username: "discobot" } });
      },

      async test(assert) {
        assert.equal(
          query(".chat-message-info__username").innerText.trim(),
          this.message.user.username
        );
      },
    });

    componentTest("date", {
      template: hbs`{{chat-message-info message=message}}`,

      beforeEach() {
        this.set("message", { created_at: moment() });
      },

      async test(assert) {
        assert.ok(exists(".chat-message-info__date"));
      },
    });

    componentTest("no user", {
      template: hbs`{{chat-message-info message=message}}`,

      beforeEach() {
        this.set("message", {});
      },
      async test(assert) {
        assert.equal(
          query(".chat-message-info__username").innerText.trim(),
          I18n.t("chat.user_deleted")
        );
      },
    });

    componentTest("reviewable", {
      template: hbs`{{chat-message-info message=message}}`,

      beforeEach() {
        this.set("message", {
          user: { username: "discobot" },
          user_flag_status: 0,
        });
      },

      async test(assert) {
        assert.equal(
          query(".chat-message-info__flag > .svg-icon-title").title,
          I18n.t("chat.you_flagged")
        );

        this.set("message", {
          user: { username: "discobot" },
          reviewable_id: 1,
        });

        assert.equal(
          query(".chat-message-info__flag a .svg-icon-title").title,
          I18n.t("chat.flagged")
        );
      },
    });
  }
);
