import Component from "@ember/component";
import discourseComputed, { bind } from "discourse-common/utils/decorators";
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
    cancel(this._hoverTimer);
    this.react(this.emoji, this.reacted ? "remove" : "add");
  },

  didInsertElement() {
    this._super(...arguments);
    this.setProperties({
      enterEvent: this.site.mobileView ? "mouseover" : "mouseenter",
      leaveEvent: this.site.mobileView ? "mouseout" : "mouseleave",
    });
    this.element.addEventListener(this.enterEvent, this.handleMouseEnter);
    this.element.addEventListener(this.leaveEvent, this.handleMouseLeave);
  },

  willDestroyElement() {
    this._super(...arguments);
    this.element.removeEventListener(this.enterEvent, this.handleMouseEnter);
    this.element.removeEventListener(this.leaveEvent, this.handleMouseLeave);
    if (this._hoverTimer) {
      cancel(this._hoverTimer);
    }
  },

  @bind
  handleMouseEnter(e) {
    this._hoverTimer = later(() => {
      this.showUsersList(this);
    }, 500);
    e.preventDefault();
  },

  @bind
  handleMouseLeave() {
    cancel(this._hoverTimer);
    this.hideUsersList();
  },
});
