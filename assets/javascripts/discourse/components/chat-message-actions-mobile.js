import Component from "@ember/component";
import { later } from "@ember/runloop";
import { action } from "@ember/object";

export default Component.extend({
  tagName: "",
  isExpanded: false,
  messageActions: null,

  didInsertElement() {
    this._super(...arguments);

    later(this._addFadeIn);
  },

  @action
  expandReply(event) {
    event.stopPropagation();
    this.set("isExpanded", true);
  },

  @action
  collapseMenu(event) {
    event.stopPropagation();
    this.onHoverMessage();
  },

  @action
  actAndCloseMenu(fn) {
    fn?.();
    this.onHoverMessage();
  },

  _addFadeIn() {
    document
      .querySelector(".chat-msgactions-backdrop")
      ?.classList.add("fade-in");
  },
});
