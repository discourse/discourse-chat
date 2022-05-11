import componentTest, {
  setupRenderingTest,
} from "discourse/tests/helpers/component-test";
import { click } from "@ember/test-helpers";
import {
  discourseModule,
  exists,
  query,
} from "discourse/tests/helpers/qunit-helpers";
import hbs from "htmlbars-inline-precompile";

discourseModule(
  "Discourse Chat | Component | chat-message-reaction",
  function (hooks) {
    setupRenderingTest(hooks);

    componentTest("accepts arbitrary class property", {
      template: hbs`{{chat-message-reaction class="foo"}}`,

      async test(assert) {
        assert.ok(exists(".chat-message-reaction.foo"));
      },
    });

    componentTest("adds reacted class when user reacted", {
      template: hbs`{{chat-message-reaction reacted=true}}`,

      async test(assert) {
        assert.ok(exists(".chat-message-reaction.reacted"));
      },
    });

    componentTest("adds reaction name as class", {
      template: hbs`{{chat-message-reaction emoji="heart"}}`,

      async test(assert) {
        assert.ok(exists(".chat-message-reaction.heart"));
      },
    });

    componentTest("adds show class when count is positive", {
      template: hbs`{{chat-message-reaction count=this.count}}`,

      beforeEach() {
        this.set("count", 0);
      },

      async test(assert) {
        assert.notOk(exists(".chat-message-reaction.show"));

        this.set("count", 1);

        assert.ok(exists(".chat-message-reaction.show"));
      },
    });

    componentTest("title/alt attributes", {
      template: hbs`{{chat-message-reaction emoji="heart"}}`,

      async test(assert) {
        assert.equal(query(".chat-message-reaction").title, ":heart:");
        assert.equal(query(".chat-message-reaction img").alt, ":heart:");
      },
    });

    componentTest("count of reactions", {
      template: hbs`{{chat-message-reaction count=this.count}}`,

      beforeEach() {
        this.set("count", 0);
      },

      async test(assert) {
        assert.notOk(exists(".chat-message-reaction .count"));

        this.set("count", 2);

        assert.equal(query(".chat-message-reaction .count").innerText, "2");
      },
    });

    componentTest("reaction’s image", {
      template: hbs`{{chat-message-reaction emoji="heart"}}`,

      async test(assert) {
        const src = query(".chat-message-reaction img").src;
        assert.ok(/heart\.png/.test(src));
      },
    });

    componentTest("click action", {
      template: hbs`{{chat-message-reaction class="show" count=this.count react=this.react}}`,

      beforeEach() {
        this.set("count", 0);
        this.set("react", () => {
          this.set("count", 1);
        });
      },

      async test(assert) {
        assert.notOk(exists(".chat-message-reaction .count"));

        await click(".chat-message-reaction");

        assert.equal(query(".chat-message-reaction .count").innerText, "1");
      },
    });
  }
);
