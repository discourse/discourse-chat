import Component from "@ember/component";
import { later } from "@ember/runloop";
import { action } from "@ember/object";
import { isTesting } from "discourse-common/config/environment";

export default Component.extend({
  tagName: "",
  isExpanded: false,
  messageActions: null,

  didInsertElement() {
    this._super(...arguments);

    later(this._addFadeIn);

    if (this.capabilities.canVibrate && !isTesting()) {
      navigator.vibrate(5);
    }
  },

  @action
  expandReply(event) {
    event.stopPropagation();
    this.set("isExpanded", true);
  },

  @action
  collapseMenu(event) {
    event.stopPropagation();
    this.onCloseMenu();
  },

  @action
  actAndCloseMenu(fn) {
    fn?.();
    this.onCloseMenu();
  },

  onCloseMenu() {
    document
      .querySelector(".chat-msgactions-backdrop")
      .classList?.remove("fade-in");

    // we don't want to remove the component right away as it's animating
    // 200 is equal to the duration of the css animation
    later(() => {
      if (this.isDestroying || this.isDestroyed) {
        return;
      }

      this.onHoverMessage(this.message);
    }, 200);
  },

  _addFadeIn() {
    document
      .querySelector(".chat-msgactions-backdrop")
      ?.classList.add("fade-in");
  },
});
