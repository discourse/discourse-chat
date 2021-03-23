import Component from "@ember/component";
import discourseComputed, { observes } from "discourse-common/utils/decorators";
import I18n from "I18n";
import { throttle } from "@ember/runloop";

export default Component.extend({
  classNames: ["tc-composer"],
  value: "",
  sendIcon: "play",
  sendTitle: "chat.send",
  placeholderKey: "chat.placeholder",

  didInsertElement() {
    this._super(...arguments);
    this.textarea().rows = 1;
  },

  textarea() {
    return this.element.querySelector('textarea');
  },

  @observes("value")
  _watchChanges() {
    // throttle, not debounce, because we do eventually want to react during the typing
    throttle(this, this._setMinHeight, 150);
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
    internalSendChat(evt) {
      const p = this.sendChat(this.value, evt);
      const cleanup = () => {
        this.set('value', "");
        // If user resized textarea to write a long message, reset it.
        const textarea = this.element.querySelector('textarea');
        textarea.style = "";
        textarea.rows = 1;
      };
      if (p.then) {
        // do NOT cleanup on reject
        p.then(cleanup);
      } else {
        cleanup();
      }
    },
  },
});
