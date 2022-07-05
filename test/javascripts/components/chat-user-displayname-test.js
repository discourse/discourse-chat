import componentTest, {
  setupRenderingTest,
} from "discourse/tests/helpers/component-test";
import { discourseModule, query } from "discourse/tests/helpers/qunit-helpers";
import hbs from "htmlbars-inline-precompile";
import { set } from "@ember/object";

function displayname() {
  return query(".chat-user-displayname").innerText.trim();
}

discourseModule(
  "Discourse Chat | Component | chat-user-displayname | prioritize username in UX",
  function (hooks) {
    setupRenderingTest(hooks);

    componentTest("username and no name", {
      template: hbs`{{chat-user-displayname user=user}}`,

      async beforeEach() {
        set(this.siteSettings, "prioritize_username_in_ux", true);
        this.set("user", { username: "bob", name: null });
      },

      async test(assert) {
        assert.equal(displayname(), "bob");
      },
    });

    componentTest("username and name", {
      template: hbs`{{chat-user-displayname user=user}}`,

      async beforeEach() {
        set(this.siteSettings, "prioritize_username_in_ux", true);
        this.set("user", { username: "bob", name: "Bobcat" });
      },

      async test(assert) {
        assert.equal(displayname(), "bob - Bobcat");
      },
    });
  }
);

discourseModule(
  "Discourse Chat | Component | chat-user-displayname | prioritize name in UX",
  function (hooks) {
    setupRenderingTest(hooks);

    componentTest("no name", {
      template: hbs`{{chat-user-displayname user=user}}`,

      async beforeEach() {
        set(this.siteSettings, "prioritize_username_in_ux", false);
        this.set("user", { username: "bob", name: null });
      },

      async test(assert) {
        assert.equal(displayname(), "bob");
      },
    });

    componentTest("name and username", {
      template: hbs`{{chat-user-displayname user=user}}`,

      async beforeEach() {
        set(this.siteSettings, "prioritize_username_in_ux", false);
        this.set("user", { username: "bob", name: "Bobcat" });
      },

      async test(assert) {
        assert.equal(displayname(), "Bobcat - bob");
      },
    });
  }
);
