import Component from "@ember/component";
import { later } from "@ember/runloop";

export default Component.extend({
  tagName: "",

  didInsertElement() {
    this._super(...arguments);

    later(this._addFadeIn);
  },

  _addFadeIn() {
    document
      .querySelector(".chat-msgactions-backdrop")
      ?.classList.add("fade-in");
  },
});
