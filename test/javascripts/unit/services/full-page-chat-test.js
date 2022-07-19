import { discourseModule } from "discourse/tests/helpers/qunit-helpers";
import { test } from "qunit";

discourseModule(
  "Discourse Chat | Unit | Service | full-page-chat",
  function (hooks) {
    hooks.beforeEach(function () {
      this.fullPageChat = this.container.lookup("service:full-page-chat");
    });

    hooks.afterEach(function () {
      this.fullPageChat.exit();
    });

    test("defaults", function (assert) {
      assert.strictEqual(this.fullPageChat.isActive, false);
    });

    test("enter", function (assert) {
      this.fullPageChat.enter();
      assert.strictEqual(this.fullPageChat.isActive, true);
    });

    test("exit", function (assert) {
      this.fullPageChat.enter();
      assert.strictEqual(this.fullPageChat.isActive, true);
      this.fullPageChat.exit();
      assert.strictEqual(this.fullPageChat.isActive, false);
    });

    test("isPreferred", function (assert) {
      assert.strictEqual(this.fullPageChat.isPreferred, false);
      this.fullPageChat.isPreferred = true;
      assert.strictEqual(this.fullPageChat.isPreferred, true);
    });

    test("previous transition", function (assert) {
      const name = "foo";
      const params = { id: 1, slug: "bar" };
      this.fullPageChat.enter({ name, params });
      const transition = this.fullPageChat.exit();

      assert.equal(transition.name, name);
      assert.equal(transition.params, params);
    });
  }
);
