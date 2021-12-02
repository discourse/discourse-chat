import Component from "@ember/component";
import discourseComputed from "discourse-common/utils/decorators";
import { action } from "@ember/object";
import { cancel, later } from "@ember/runloop";

export default Component.extend({
  classNames: "chat-message-reaction",
  classNameBindings: ["reacted", "count:show", "emoji"],
  _hoverTimer: null,

  @discourseComputed("emoji")
  emojiString(emoji) {
    return `:${emoji}:`;
  },

  click() {
    this.react(this.emoji, this.reacted ? "remove" : "add");
  },

  didInsertElement() {
    this._super(...arguments);
    this.element.addEventListener("mouseenter", this.handleMouseEnter);
    this.element.addEventListener("mouseleave", this.handleMouseLeave);
  },

  willDestroyElement() {
    this._super(...arguments);
    this.element.removeEventListener("mouseenter", this.handleMouseEnter);
    this.element.removeEventListener("mouseleave", this.handleMouseLeave);
    if (this._hoverTimer) {
      cancel(this._hoverTimer);
    }
  },

  @action
  handleMouseEnter() {
    this._hoverTimer = later(() => {
      this.showUsersList(this);
    }, 500);
  },

  @action
  handleMouseLeave() {
    cancel(this._hoverTimer);
    this.hideUsersList();
  },
});
