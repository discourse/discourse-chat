import { module, test } from "qunit";
import { getOwner } from "discourse-common/lib/get-owner";

module("Discourse Chat | Unit | chat-emoji-reaction-store", function (hooks) {
  hooks.beforeEach(function () {
    this.siteSettings = getOwner(this).lookup("service:site-settings");
    this.emojiReactionStore = getOwner(this).lookup(
      "service:chat-emoji-reaction-store"
    );

    this.emojiReactionStore.siteSettings = this.siteSettings;
    this.emojiReactionStore.reset();
  });

  hooks.afterEach(function () {
    this.emojiReactionStore.reset();
  });

  // TODO (martin) Remove site setting workarounds after core PR#1290
  test("defaults", function (assert) {
    assert.deepEqual(
      this.emojiReactionStore.favorites,
      (this.siteSettings.default_emoji_reactions || "")
        .split("|")
        .filter((val) => val)
    );
    assert.strictEqual(this.emojiReactionStore.diversity, 1);
  });

  test("diversity", function (assert) {
    this.emojiReactionStore.diversity = 2;
    assert.strictEqual(this.emojiReactionStore.diversity, 2);
  });

  test("favorites - default reactions", function (assert) {
    this.siteSettings.default_emoji_reactions = "smile|heart|tada";
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
    let expected = ["woman:t4"];

    if (this.siteSettings.default_emoji_reactions) {
      expected = expected.concat(
        this.siteSettings.default_emoji_reactions.split("|")
      );
    }
    assert.deepEqual(this.emojiReactionStore.favorites, expected);

    this.emojiReactionStore.track("otter");

    expected = ["otter", "woman:t4"];
    if (this.siteSettings.default_emoji_reactions) {
      expected = expected.concat(
        this.siteSettings.default_emoji_reactions.split("|")
      );
    }
    assert.deepEqual(this.emojiReactionStore.favorites, expected);
  });
});
