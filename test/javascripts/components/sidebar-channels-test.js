import componentTest, {
  setupRenderingTest,
} from "discourse/tests/helpers/component-test";
import hbs from "htmlbars-inline-precompile";
import { discourseModule, exists } from "discourse/tests/helpers/qunit-helpers";
import {
  setup as setupChatStub,
  teardown as teardownChatStub,
} from "../helpers/chat-stub";

discourseModule(
  "Discourse chat | Component | sidebar-channels",
  function (hooks) {
    setupRenderingTest(hooks);

    componentTest("chat is not isolated", {
      template: hbs`{{sidebar-channels}}`,

      beforeEach() {
        this.set("currentUser.chat_isolated", false);

        setupChatStub(this);
      },

      afterEach() {
        teardownChatStub();
      },

      async test(assert) {
        assert.ok(exists("[data-chat-channel-id]"));
      },
    });

    componentTest("chat is on browse page", {
      template: hbs`{{sidebar-channels}}`,

      beforeEach() {
        this.set("currentUser.chat_isolated", true);

        setupChatStub(this, { isBrowsePage: true });
      },

      afterEach() {
        teardownChatStub();
      },

      async test(assert) {
        assert.ok(exists("[data-chat-channel-id]"));
      },
    });

    componentTest("chat is on chat page", {
      template: hbs`{{sidebar-channels}}`,

      beforeEach() {
        this.set("currentUser.chat_isolated", true);

        setupChatStub(this, { isChatPage: true });
      },

      afterEach() {
        teardownChatStub();
      },

      async test(assert) {
        assert.ok(exists("[data-chat-channel-id]"));
      },
    });

    componentTest("none of the conditions are fullfilled", {
      template: hbs`{{sidebar-channels}}`,

      beforeEach() {
        this.set("currentUser.chat_isolated", true);

        setupChatStub(this);
      },

      afterEach() {
        teardownChatStub();
      },

      async test(assert) {
        assert.notOk(exists("[data-chat-channel-id]"));
      },
    });

    componentTest("user cant chat", {
      template: hbs`{{sidebar-channels}}`,

      beforeEach() {
        this.set("currentUser.chat_isolated", false);

        setupChatStub(this, { userCanChat: false });
      },

      afterEach() {
        teardownChatStub();
      },

      async test(assert) {
        assert.notOk(exists("[data-chat-channel-id]"));
      },
    });
  }
);
