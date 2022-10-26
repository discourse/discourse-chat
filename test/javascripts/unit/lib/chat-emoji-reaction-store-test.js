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
  });

  test("diversity", function (assert) {
    assert.strictEqual(this.emojiReactionStore.diversity, 1);

    this.emojiReactionStore.diversity = 2;

    assert.strictEqual(this.emojiReactionStore.diversity, 2);
  });

  test("when displaying default favorites", function (assert) {
    this.siteSettings.default_emoji_reactions = "smile|heart|tada";

    assert.deepEqual(this.emojiReactionStore.favorites, [
      "smile",
      "heart",
      "tada",
    ]);
  });

  test("when tracking an emoji", function (assert) {
    this.emojiReactionStore.storedFavorites = [];
    this.emojiReactionStore.track("yum");

    assert.deepEqual(this.emojiReactionStore.storedFavorites, ["yum"]);
  });

  test("when tracking multiple times the same emoji", function (assert) {
    this.emojiReactionStore.storedFavorites = [];
    this.emojiReactionStore.track("yum");
    this.emojiReactionStore.track("yum");

    assert.deepEqual(this.emojiReactionStore.storedFavorites, ["yum", "yum"]);
  });

  test("when tracking different emojis", function (assert) {
    this.emojiReactionStore.storedFavorites = [];
    this.emojiReactionStore.track("yum");
    this.emojiReactionStore.track("not_yum");
    this.emojiReactionStore.track("yum");
    this.emojiReactionStore.track("grinning");

    assert.deepEqual(
      this.emojiReactionStore.storedFavorites,
      ["grinning", "yum", "not_yum", "yum"],
      "it ensures last in is first"
    );
  });

  test("when tracking an emoji after reaching the limit", function (assert) {
    this.emojiReactionStore.storedFavorites = [];
    [...Array(this.emojiReactionStore.MAX_TRACKED_EMOJIS)].forEach(() => {
      this.emojiReactionStore.track("yum");
    });
    this.emojiReactionStore.track("grinning");

    assert.strictEqual(
      this.emojiReactionStore.storedFavorites.length,
      this.emojiReactionStore.MAX_TRACKED_EMOJIS,
      "it enforces the max length"
    );
    assert.strictEqual(
      this.emojiReactionStore.storedFavorites.firstObject,
      "grinning",
      "it correctly stores the last tracked emoji"
    );
  });
});
