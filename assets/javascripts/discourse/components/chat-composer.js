import I18n from "I18n";
import Component from "@ember/component";
import discourseComputed, { observes } from "discourse-common/utils/decorators";
import userSearch from "discourse/lib/user-search";
import { action } from "@ember/object";
import { cancel, throttle } from "@ember/runloop";
import { findRawTemplate } from "discourse-common/lib/raw-templates";
import { not } from "@ember/object/computed";

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
    if (evt.code === "Enter") {
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
    if (evt.code === "Escape") {
      if (this.replyToMsg) {
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
    this.timer = throttle(
      this,
      () => {
        this._setMinHeight();
        this._applyAutocomplete();
      },
      150
    );
  },

  _applyAutocomplete() {
    if (this.siteSettings.enable_mentions) {
      $(this.textarea()).autocomplete({
        template: findRawTemplate("user-selector-autocomplete"),
        key: "@",
        width: "100%",
        treatAsTextarea: true,
        autoSelectFirstSuggestion: false,
        transformComplete: (v) => v.username || v.name,
        dataSource: (term) => userSearch({ term, includeGroups: false }),
      });
    }
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

  inputDisabled: not("canChat"),

  // evt: either ClickEvent or KeyboardEvent
  @action
  internalSendChat(evt) {
    if (evt) {
      evt.preventDefault();
    }
    if ((this.value || "").trim() === "") {
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

  @action
  cancelReplyTo() {
    this.set("replyToMsg", null);
  },
});
