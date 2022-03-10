import { discourseModule } from "discourse/tests/helpers/qunit-helpers";
import { test } from "qunit";

discourseModule("Discourse Chat | Unit | chat-emoji-store", function (hooks) {
  hooks.beforeEach(function () {
    this.emojiStore = this.container.lookup("service:chat-emoji-store");
    this.emojiStore.siteSettings = this.container.lookup("site-settings:main");
    this.emojiStore.reset();
  });

  hooks.afterEach(function () {
    this.emojiStore.reset();
  });

  test("defaults", function (assert) {
    assert.deepEqual(this.emojiStore.favorites, []);
    assert.strictEqual(this.emojiStore.diversity, 1);
  });

  test("diversity", function (assert) {
    this.emojiStore.diversity = 2;
    assert.strictEqual(this.emojiStore.diversity, 2);
  });

  test("favorites", function (assert) {
    this.emojiStore.favorites = ["smile"];
    assert.deepEqual(this.emojiStore.favorites, ["smile"]);
  });

  test("track", function (assert) {
    this.emojiStore.track("woman:t4");
    assert.deepEqual(this.emojiStore.favorites, ["woman:t4"]);
    this.emojiStore.track("otter");
    assert.deepEqual(this.emojiStore.favorites, ["otter", "woman:t4"]);
  });

  test("reactions", function (assert) {
    this.emojiStore.siteSettings.default_emoji_reactions = "smile|heart|tada";
    assert.deepEqual(this.emojiStore.reactions, ["smile", "heart", "tada"]);
  });
});
