import Component from "@ember/component";
import discourseComputed, { observes } from "discourse-common/utils/decorators";
import I18n from "I18n";
import { cancel, throttle } from "@ember/runloop";

export default Component.extend({
  classNames: ["tc-composer"],
  value: "",
  sendIcon: "play",
  sendTitle: "chat.send",
  placeholderKey: "chat.placeholder",

  timer: null,

  didInsertElement() {
    this._super(...arguments);
    this.textarea().rows = 1;
  },

  willDestroyElement() {
    this._super(...arguments);
    if (this.timer) {
      cancel(this.timer);
      this.timer = null;
    }
  },

  textarea() {
    return this.element.querySelector("textarea");
  },

  keyDown(evt) {
    if (evt.keyCode === /* ENTER */ 13) {
      if (evt.shiftKey) {
        // Shift+Enter: insert newline
        return;
      }
      if (evt.altKey) {
        // Alt+Enter: no action
        return;
      }
      if (evt.metaKey) {
        // Super+Enter: no action
        return;
      }
      // Ctrl+Enter, plain Enter: send

      this.send("internalSendChat", evt);
    }
  },

  @observes("value")
  _watchChanges() {
    // throttle, not debounce, because we do eventually want to react during the typing
    this.timer = throttle(this, this._setMinHeight, 150);
  },

  _setMinHeight() {
    const textarea = this.textarea();
    if (textarea.scrollHeight > textarea.clientHeight) {
      if (textarea.rows < 3) {
        textarea.rows = textarea.rows + 1;
      }
    }
  },

  @discourseComputed("placeholderKey")
  placeholder(key) {
    return I18n.t(key);
  },

  actions: {
    // evt: either ClickEvent or KeyboardEvent
    internalSendChat(evt) {
      return this.sendChat(this.value, evt).then(() => {
        this.set("value", "");
        // If user resized textarea to write a long message, reset it.
        const textarea = this.element.querySelector("textarea");
        textarea.style = "";
        textarea.rows = 1;
      });
    },
  },
});
