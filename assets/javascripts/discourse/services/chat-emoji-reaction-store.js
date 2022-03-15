// This class is duplicated from emoji-store class in core. We want to maintain separate emoji store for reactions in chat plugin.
// https://github.com/discourse/discourse/blob/892f7e0506f3a4d40d9a59a4c926ff0a2aa0947e/app/assets/javascripts/discourse/app/services/emoji-store.js

import KeyValueStore from "discourse/lib/key-value-store";
import Service from "@ember/service";

const EMOJI_USAGE = "emojiUsage";
const EMOJI_SELECTED_DIVERSITY = "emojiSelectedDiversity";
const TRACKED_EMOJIS = 15;
const STORE_NAMESPACE = "discourse_chat_emoji_reaction_";

export default Service.extend({
  init() {
    this._super(...arguments);

    this.store = new KeyValueStore(STORE_NAMESPACE);

    if (!this.store.getObject(EMOJI_USAGE)) {
      this.favorites = [];
    }
  },

  get diversity() {
    return this.store.getObject(EMOJI_SELECTED_DIVERSITY) || 1;
  },

  set diversity(value) {
    this.store.setObject({ key: EMOJI_SELECTED_DIVERSITY, value: value || 1 });
  },

  get reactions() {
    if (!this.siteSettings.default_emoji_reactions) {
      return [];
    }
    return this.siteSettings.default_emoji_reactions.split("|").filter(Boolean);
  },

  get favorites() {
    if (this.store.getObject(EMOJI_USAGE).length < 1) {
      if (!this.siteSettings.default_emoji_reactions) {
        this.store.setObject({ key: EMOJI_USAGE, value: [] });
      } else {
        const reactions = this.siteSettings.default_emoji_reactions
          .split("|")
          .filter(Boolean);
        this.store.setObject({ key: EMOJI_USAGE, value: reactions });
      }
    }
    return this.store.getObject(EMOJI_USAGE) || [];
  },

  set favorites(value) {
    this.store.setObject({ key: EMOJI_USAGE, value: value || [] });
    this.notifyPropertyChange("favorites");
  },

  track(code) {
    const normalizedCode = code.replace(/(^:)|(:$)/g, "");
    const recent = this.favorites.filter((r) => r !== normalizedCode);
    recent.unshift(normalizedCode);
    recent.length = Math.min(recent.length, TRACKED_EMOJIS);
    this.favorites = recent;
  },

  reset() {
    const store = new KeyValueStore(STORE_NAMESPACE);
    store.setObject({ key: EMOJI_USAGE, value: [] });
    store.setObject({ key: EMOJI_SELECTED_DIVERSITY, value: 1 });
  },
});
