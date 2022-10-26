import { module, test } from "qunit";
import { getOwner } from "discourse-common/lib/get-owner";

module("Discourse Chat | Unit | chat-emoji-reaction-store", function (hooks) {
  hooks.beforeEach(function () {
    this.siteSettings = getOwner(this).lookup("service:site-settings");
    this.chatEmojiReactionStore = getOwner(this).lookup(
      "service:chat-emoji-reaction-store"
    );

    this.chatEmojiReactionStore.siteSettings = this.siteSettings;
    this.chatEmojiReactionStore.reset();
  });

  hooks.afterEach(function () {
    this.chatEmojiReactionStore.reset();
  });

  // TODO (martin) Remove site setting workarounds after core PR#1290
  test("defaults", function (assert) {
    assert.deepEqual(
      this.chatEmojiReactionStore.favorites,
      (this.siteSettings.default_emoji_reactions || "")
        .split("|")
        .filter((val) => val)
    );
  });

  test("diversity", function (assert) {
    assert.strictEqual(this.chatEmojiReactionStore.diversity, 1);

    this.chatEmojiReactionStore.diversity = 2;

    assert.strictEqual(this.chatEmojiReactionStore.diversity, 2);
  });

  test("when displaying default favorites", function (assert) {
    this.siteSettings.default_emoji_reactions = "smile|heart|tada";

    assert.deepEqual(this.chatEmojiReactionStore.favorites, [
      "smile",
      "heart",
      "tada",
    ]);
  });

  test("when tracking an emoji", function (assert) {
    this.chatEmojiReactionStore.storedFavorites = [];
    this.chatEmojiReactionStore.track("yum");

    assert.deepEqual(this.chatEmojiReactionStore.storedFavorites, ["yum"]);
  });

  test("when tracking multiple times the same emoji", function (assert) {
    this.chatEmojiReactionStore.storedFavorites = [];
    this.chatEmojiReactionStore.track("yum");
    this.chatEmojiReactionStore.track("yum");

    assert.deepEqual(this.chatEmojiReactionStore.storedFavorites, [
      "yum",
      "yum",
    ]);
  });

  test("when tracking different emojis", function (assert) {
    this.chatEmojiReactionStore.storedFavorites = [];
    this.chatEmojiReactionStore.track("yum");
    this.chatEmojiReactionStore.track("not_yum");
    this.chatEmojiReactionStore.track("yum");
    this.chatEmojiReactionStore.track("grinning");

    assert.deepEqual(
      this.chatEmojiReactionStore.storedFavorites,
      ["grinning", "yum", "not_yum", "yum"],
      "it ensures last in is first"
    );
  });

  test("when tracking an emoji after reaching the limit", function (assert) {
    this.chatEmojiReactionStore.storedFavorites = [];
    [...Array(this.chatEmojiReactionStore.MAX_TRACKED_EMOJIS)].forEach(() => {
      this.chatEmojiReactionStore.track("yum");
    });
    this.chatEmojiReactionStore.track("grinning");

    assert.strictEqual(
      this.chatEmojiReactionStore.storedFavorites.length,
      this.chatEmojiReactionStore.MAX_TRACKED_EMOJIS,
      "it enforces the max length"
    );
    assert.strictEqual(
      this.chatEmojiReactionStore.storedFavorites.firstObject,
      "grinning",
      "it correctly stores the last tracked emoji"
    );
  });
});
