import Component from "@ember/component";
import discourseComputed, { observes } from "discourse-common/utils/decorators";
import I18n from "I18n";
import { cancel, throttle } from "@ember/runloop";

export default Component.extend({
  classNames: ["tc-composer"],
  value: "",
  sendIcon: "play",
  sendTitle: "chat.send",

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
    if (evt.code === "Enter" || evt.keyCode === 13) {
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
    if (evt.code === "Escape" || evt.which === 27) {
      if (this.get("replyToMsg") !== null) {
        evt.preventDefault();
        this.set("replyToMsg", null);
      } else {
        this.element.querySelector("textarea").blur();
      }
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
    if (this.onChangeHeight) {
      this.onChangeHeight();
    }
  },

  @discourseComputed("canChat")
  placeholder(canChat) {
    return I18n.t(canChat ? "chat.placeholder" : "chat.placeholder_log_in");
  },

  @discourseComputed("canChat", "loading")
  sendDisabled(canChat, loading) {
    return !canChat || loading;
  },

  @discourseComputed("canChat")
  inputDisabled(canChat) {
    return !canChat;
  },

  actions: {
    // evt: either ClickEvent or KeyboardEvent
    internalSendChat(evt) {
      if (evt) {
        evt.preventDefault();
      }
      if (this.get("value").trim() === "") {
        return;
      }
      return this.sendChat(this.value, evt).then(() => {
        this.set("value", "");
        // If user resized textarea to write a long message, reset it.
        const textarea = this.element.querySelector("textarea");
        textarea.style = "";
        textarea.rows = 1;
        textarea.focus();
      });
    },

    cancelReplyTo() {
      this.set("replyToMsg", null);
    },
  },
});
