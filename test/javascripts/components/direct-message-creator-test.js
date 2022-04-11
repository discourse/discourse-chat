import componentTest, {
  setupRenderingTest,
} from "discourse/tests/helpers/component-test";
import { click, fillIn } from "@ember/test-helpers";
import hbs from "htmlbars-inline-precompile";
import { discourseModule, exists } from "discourse/tests/helpers/qunit-helpers";
import { createDirectMessageChannelDraft } from "discourse/plugins/discourse-chat/discourse/models/chat-channel";
import { Promise } from "rsvp";
import fabricate from "../helpers/fabricators";

function mockChat(context, options = {}) {
  const mock = context.container.lookup("service:chat");
  mock.searchPossibleDirectMessageUsers = () => {
    return Promise.resolve({
      users: options.users || [{ username: "hawk" }, { username: "mark" }],
    });
  };
  mock.getDmChannelForUsernames = () => {
    return Promise.resolve({ chat_channel: fabricate("chat-channel") });
  };
  return mock;
}

discourseModule(
  "Discourse chat | Component | direct-message-creator",
  function (hooks) {
    setupRenderingTest(hooks);

    componentTest("search", {
      template: hbs`{{direct-message-creator channel=channel chat=chat}}`,

      beforeEach() {
        this.set("chat", mockChat(this));
        this.set("channel", createDirectMessageChannelDraft());
      },

      async test(assert) {
        await fillIn(".filter-usernames", "hawk");
        assert.ok(exists("li.user[data-username='hawk']"));
      },
    });

    componentTest("select/deselect", {
      template: hbs`{{direct-message-creator channel=channel chat=chat}}`,

      beforeEach() {
        this.set("chat", mockChat(this));
        this.set("channel", createDirectMessageChannelDraft());
      },

      async test(assert) {
        assert.notOk(exists(".selected-user"));

        await fillIn(".filter-usernames", "hawk");
        await click("li.user[data-username='hawk']");

        assert.ok(exists(".selected-user"));

        await click(".selected-user");

        assert.notOk(exists(".selected-user"));
      },
    });

    componentTest("no search results", {
      template: hbs`{{direct-message-creator channel=channel chat=chat}}`,

      beforeEach() {
        this.set("chat", mockChat(this, { users: [] }));
        this.set("channel", createDirectMessageChannelDraft());
      },

      async test(assert) {
        await fillIn(".filter-usernames", "bad cat");

        assert.ok(exists(".no-results"));
      },
    });

    componentTest("loads user on first load", {
      template: hbs`{{direct-message-creator channel=channel chat=chat}}`,

      beforeEach() {
        this.set("chat", mockChat(this));
        this.set("channel", createDirectMessageChannelDraft());
      },

      async test(assert) {
        assert.ok(exists("li.user[data-username='hawk']"));
        assert.ok(exists("li.user[data-username='mark']"));
      },
    });

    componentTest("do not load more users after selection", {
      template: hbs`{{direct-message-creator channel=channel chat=chat}}`,

      beforeEach() {
        this.set("chat", mockChat(this));
        this.set("channel", createDirectMessageChannelDraft());
      },

      async test(assert) {
        await click("li.user[data-username='hawk']");

        assert.notOk(exists("li.user[data-username='mark']"));
      },
    });

    componentTest("apply is-focused to filter-area on focus input", {
      template: hbs`{{direct-message-creator channel=channel chat=chat}}<button class="test-blur">blur</button>`,

      beforeEach() {
        this.set("chat", mockChat(this));
        this.set("channel", createDirectMessageChannelDraft());
      },

      async test(assert) {
        await click(".filter-usernames");

        assert.ok(exists(".filter-area.is-focused"));

        await click(".test-blur");

        assert.notOk(exists(".filter-area.is-focused"));
      },
    });
  }
);
