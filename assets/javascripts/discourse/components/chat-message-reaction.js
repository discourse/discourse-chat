import Component from "@ember/component";
import { bind } from "discourse-common/utils/decorators";
import { cancel, later } from "@ember/runloop";
import { fmt } from "discourse/lib/computed";

export default Component.extend({
  classNames: "chat-message-reaction",
  classNameBindings: ["reacted", "count:show", "emoji"],
  attributeBindings: ["role", "tabindex"],
  role: "button",
  emoji: null,
  showUsersList: null,
  hideUsersList: null,
  reacted: null,
  enterEvent: null,
  leaveEvent: null,
  count: null,
  _hoverTimer: null,
  tabindex: 0,

  emojiString: fmt("emoji", ":%@:"),

  click() {
    cancel(this._hoverTimer);
    this.react(this.emoji, this.reacted ? "remove" : "add");
    return false;
  },

  didInsertElement() {
    this._super(...arguments);

    if (this.showUsersList && this.hideUsersList) {
      this.setProperties({
        enterEvent: this.site.mobileView ? "mouseover" : "mouseenter",
        leaveEvent: this.site.mobileView ? "mouseout" : "mouseleave",
      });
      this.element.addEventListener(this.enterEvent, this._handleMouseEnter);
      this.element.addEventListener(this.leaveEvent, this._handleMouseLeave);
    }
  },

  willDestroyElement() {
    this._super(...arguments);

    if (this.showUsersList && this.hideUsersList) {
      this.element.removeEventListener(this.enterEvent, this._handleMouseEnter);
      this.element.removeEventListener(this.leaveEvent, this._handleMouseLeave);
      cancel(this._hoverTimer);
    }
  },

  @bind
  _handleMouseEnter(event) {
    cancel(this._hoverTimer);

    this._hoverTimer = later(() => {
      this.showUsersList(this);
    }, 500);
    event.preventDefault();
  },

  @bind
  _handleMouseLeave() {
    cancel(this._hoverTimer);
    this.hideUsersList();
  },
});
