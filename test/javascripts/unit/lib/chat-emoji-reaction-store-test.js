import { discourseModule } from "discourse/tests/helpers/qunit-helpers";
import { test } from "qunit";

discourseModule(
  "Discourse Chat | Unit | chat-emoji-reaction-store",
  function (hooks) {
    hooks.beforeEach(function () {
      this.emojiReactionStore = this.container.lookup(
        "service:chat-emoji-reaction-store"
      );
      this.emojiReactionStore.siteSettings =
        this.container.lookup("site-settings:main");
      this.emojiReactionStore.reset();
    });

    hooks.afterEach(function () {
      this.emojiReactionStore.reset();
    });

    test("defaults", function (assert) {
      assert.deepEqual(this.emojiReactionStore.favorites, []);
      assert.strictEqual(this.emojiReactionStore.diversity, 1);
    });

    test("diversity", function (assert) {
      this.emojiReactionStore.diversity = 2;
      assert.strictEqual(this.emojiReactionStore.diversity, 2);
    });

    test("favorites - default reactions", function (assert) {
      this.emojiReactionStore.siteSettings.default_emoji_reactions =
        "smile|heart|tada";
      assert.deepEqual(this.emojiReactionStore.favorites, [
        "smile",
        "heart",
        "tada",
      ]);
    });

    test("favorites", function (assert) {
      this.emojiReactionStore.favorites = ["yum", "wink", "innocent"];
      assert.deepEqual(this.emojiReactionStore.favorites, [
        "yum",
        "wink",
        "innocent",
      ]);
    });

    test("track", function (assert) {
      this.emojiReactionStore.track("woman:t4");
      assert.deepEqual(this.emojiReactionStore.favorites, ["woman:t4"]);
      this.emojiReactionStore.track("otter");
      assert.deepEqual(this.emojiReactionStore.favorites, [
        "otter",
        "woman:t4",
      ]);
    });
  }
);
