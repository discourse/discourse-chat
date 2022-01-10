import { set } from "@ember/object";
import componentTest, {
  setupRenderingTest,
} from "discourse/tests/helpers/component-test";
import { discourseModule, query } from "discourse/tests/helpers/qunit-helpers";
import hbs from "htmlbars-inline-precompile";

discourseModule(
  "Discourse Chat | Component | chat-composer placeholder",
  function (hooks) {
    setupRenderingTest(hooks);

    componentTest("direct message to self shows Jot something down", {
      template: hbs`{{chat-composer chatChannel=chatChannel}}`,

      beforeEach() {
        set(this.currentUser, "id", 1);
        this.set("chatChannel", {
          chatable_type: "DirectMessageChannel",
          chatable: {
            users: [{ id: 1 }],
          },
        });
      },

      async test(assert) {
        assert.equal(
          query(".tc-composer-input").placeholder,
          "Jot something down"
        );
      },
    });

    componentTest("direct message to multiple folks shows their names", {
      template: hbs`{{chat-composer chatChannel=chatChannel}}`,

      beforeEach() {
        this.set("chatChannel", {
          chatable_type: "DirectMessageChannel",
          chatable: {
            users: [
              { name: "Tomtom" },
              { name: "Steaky" },
              { username: "zorro" },
            ],
          },
        });
      },

      async test(assert) {
        assert.equal(
          query(".tc-composer-input").placeholder,
          "Chat with Tomtom, Steaky, @zorro"
        );
      },
    });

    componentTest("message to channel shows send message to channel name", {
      template: hbs`{{chat-composer chatChannel=chatChannel}}`,

      beforeEach() {
        this.set("chatChannel", {
          chatable_type: "Category",
          title: "just-cats",
        });
      },

      async test(assert) {
        assert.equal(
          query(".tc-composer-input").placeholder,
          "Chat with #just-cats"
        );
      },
    });
  }
);
