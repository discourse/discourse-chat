import componentTest, {
  setupRenderingTest,
} from "discourse/tests/helpers/component-test";
import hbs from "htmlbars-inline-precompile";
import { discourseModule, exists } from "discourse/tests/helpers/qunit-helpers";

discourseModule(
  "Discourse Chat | Component | chat message text",
  function (hooks) {
    setupRenderingTest(hooks);

    componentTest("yields", {
      template: hbs`{{#chat-message-text cooked=cooked uploads=uploads edited=edited}} <div class="yield-me"></div> {{/chat-message-text}}`,

      beforeEach() {
        this.set("cooked", "<p></p>");
      },

      async test(assert) {
        assert.ok(exists(".yield-me"));
      },
    });

    componentTest("is youtube and shows collapsed", {
      template: hbs`{{chat-message-text cooked=cooked uploads=uploads edited=edited}}`,

      beforeEach() {
        this.set(
          "cooked",
          '<div class="onebox lazyYT lazyYT-container" data-youtube-id="WaT_rLGuUr8" data-youtube-title="Japanese Katsu Curry (Pork Cutlet)"/>'
        );
      },

      async test(assert) {
        assert.ok(exists(".chat-message-collapser"));
      },
    });

    componentTest("is image and shows collapsed", {
      template: hbs`{{chat-message-text cooked=cooked uploads=uploads edited=edited}}`,

      beforeEach() {
        this.set("cooked", "<p></p>");
        this.set("uploads", [{}]);
      },

      async test(assert) {
        assert.ok(exists(".chat-message-collapser"));
      },
    });

    componentTest("is neither youtube nor image and does not show collapse", {
      template: hbs`{{chat-message-text cooked=cooked uploads=uploads edited=edited}}`,

      beforeEach() {
        this.set("cooked", "<p></p>");
      },

      async test(assert) {
        assert.notOk(exists(".chat-message-collapser"));
      },
    });

    componentTest("is edited and shows that it's edited", {
      template: hbs`{{chat-message-text cooked=cooked uploads=uploads edited=edited}}`,

      beforeEach() {
        this.set("cooked", "<p></p>");
        this.set("edited", true);
      },

      async test(assert) {
        assert.ok(exists(".tc-message-edited"));
      },
    });

    componentTest("is not edited and does not show", {
      template: hbs`{{chat-message-text cooked=cooked uploads=uploads edited=edited}}`,

      beforeEach() {
        this.set("cooked", "<p></p>");
      },

      async test(assert) {
        assert.notOk(exists(".tc-message-edited"));
      },
    });
  }
);
