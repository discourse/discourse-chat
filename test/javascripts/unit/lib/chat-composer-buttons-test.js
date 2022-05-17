import { discourseModule } from "discourse/tests/helpers/qunit-helpers";
import { test } from "qunit";
import {
  chatComposerButtons,
  chatComposerButtonsDependentKeys,
  clearChatComposerButtons,
  registerChatComposerButton,
} from "discourse/plugins/discourse-chat/discourse/lib/chat-composer-buttons";

discourseModule(
  "Discourse Chat | Unit | chat-composer-buttons",
  function (hooks) {
    hooks.beforeEach(function () {
      registerChatComposerButton({
        id: "foo",
        icon: "times",
        dependentKeys: ["test"],
      });

      registerChatComposerButton({
        id: "bar",
        translatedLabel() {
          return this.baz;
        },
      });
    });

    hooks.afterEach(function () {
      clearChatComposerButtons();
    });

    test("chatComposerButtons", function (assert) {
      const button = chatComposerButtons({ baz: "fooz" }, "inline")[1];
      assert.equal(button.id, "bar");
      assert.equal(button.label, "fooz");
    });

    test("chatComposerButtonsDependentKeys", function (assert) {
      assert.deepEqual(chatComposerButtonsDependentKeys(), ["test"]);
    });
  }
);
