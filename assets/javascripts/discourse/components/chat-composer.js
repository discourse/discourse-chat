import I18n from "I18n";
import Component from "@ember/component";
import discourseComputed from "discourse-common/utils/decorators";
import userSearch from "discourse/lib/user-search";
import { action } from "@ember/object";
import { cancel, schedule, throttle } from "@ember/runloop";
import { categoryHashtagTriggerRule } from "discourse/lib/category-hashtags";
import { findRawTemplate } from "discourse-common/lib/raw-templates";
import { emojiSearch, isSkinTonableEmoji } from "pretty-text/emoji";
import { emojiUrlFor } from "discourse/lib/text";
import { inject as service } from "@ember/service";
import { not } from "@ember/object/computed";
import { search as searchCategoryTag } from "discourse/lib/category-tag-search";
import { SKIP } from "discourse/lib/autocomplete";
import { translations } from "pretty-text/emoji/data";
import { Promise } from "rsvp";

const THROTTLE_MS = 150;

export default Component.extend({
  classNames: ["tc-composer"],
  value: "",
  emojiStore: service("emoji-store"),
  editingMessage: null,
  timer: null,
  inputDisabled: not("canChat"),
  onValueChange: null,

  didInsertElement() {
    this._super(...arguments);

    this._textarea = this.element.querySelector(".tc-composer-input");
    const $textarea = $(this._textarea);
    this._applyCategoryHashtagAutocomplete($textarea);
    this._applyEmojiAutocomplete($textarea);
  },

  willDestroyElement() {
    this._super(...arguments);
    if (this.timer) {
      cancel(this.timer);
      this.timer = null;
    }
  },

  didRender() {
    this._super(...arguments);
    if (this.canChat && this._messageIsEmpty()) {
      this._focusTextArea();
    }
  },

  keyDown(event) {
    if (event.code === "Enter") {
      if (event.shiftKey) {
        // Shift+Enter: insert newline
        return;
      }
      if (event.altKey) {
        // Alt+Enter: no action
        return;
      }
      if (event.metaKey) {
        // Super+Enter: no action
        return;
      }
      // Ctrl+Enter, plain Enter: send

      event.preventDefault();
      this.sendClicked();
    }

    if (
      event.code === "ArrowUp" &&
      this._messageIsEmpty() &&
      !this.editingMessage
    ) {
      event.preventDefault();
      this.onEditLastMessageRequested();
    }

    if (event.code === "Escape") {
      if (this.replyToMsg) {
        event.preventDefault();
        this.set("replyToMsg", null);
      } else if (this.editingMessage) {
        event.preventDefault();
        this.set("replyToMsg", null);
        this.cancelEditing();
      } else {
        this._textarea.blur();
      }
    }
  },

  didReceiveAttrs() {
    this._super(...arguments);

    if (this.editingMessage) {
      this.setProperties({
        replyToMsg: null,
        value: this.editingMessage.message,
      });
      this._focusTextArea({ ensureAtEnd: true, resizeTextArea: true });
    } else {
      // Reply button pressed. Reset composer.
      this._reset();
    }
  },

  @action
  cancelEditing() {
    this.onCancelEditing();
    this._focusTextArea({ ensureAtEnd: true, resizeTextArea: true });
  },

  @action
  onTextareaInput(value) {
    this.set("value", value);

    // throttle, not debounce, because we do eventually want to react during the typing
    this.timer = throttle(
      this,
      () => {
        this._resizeTextArea();
        this._applyUserAutocomplete();
        this.onValueChange();
      },
      THROTTLE_MS
    );
  },

  _applyUserAutocomplete() {
    if (this.siteSettings.enable_mentions) {
      $(this._textarea).autocomplete({
        template: findRawTemplate("user-selector-autocomplete"),
        key: "@",
        width: "100%",
        autoSelectFirstSuggestion: true,
        transformComplete: (v) => v.username || v.name,
        dataSource: (term) => userSearch({ term, includeGroups: false }),
      });
    }
  },

  _applyCategoryHashtagAutocomplete($textarea) {
    const siteSettings = this.siteSettings;

    $textarea.autocomplete({
      template: findRawTemplate("category-tag-autocomplete"),
      key: "#",
      afterComplete: (value) => {
        this.set("value", value);
        return this._focusTextArea();
      },
      transformComplete: (obj) => {
        return obj.text;
      },
      dataSource: (term) => {
        if (term.match(/\s/)) {
          return null;
        }
        return searchCategoryTag(term, siteSettings);
      },
      triggerRule: (textarea, opts) => {
        return categoryHashtagTriggerRule(textarea, opts);
      },
    });
  },

  _applyEmojiAutocomplete($textarea) {
    if (!this.siteSettings.enable_emoji) {
      return;
    }

    $textarea.autocomplete({
      template: findRawTemplate("emoji-selector-autocomplete"),
      key: ":",
      afterComplete: (text) => {
        this.set("value", text);
        this._focusTextArea();
      },

      onKeyUp: (text, cp) => {
        const matches = /(?:^|[\s.\?,@\/#!%&*;:\[\]{}=\-_()])(:(?!:).?[\w-]*:?(?!:)(?:t\d?)?:?) ?$/gi.exec(
          text.substring(0, cp)
        );

        if (matches && matches[1]) {
          return [matches[1]];
        }
      },

      transformComplete: (v) => {
        if (v.code) {
          this.emojiStore.track(v.code);
          return `${v.code}:`;
        } else {
          $textarea.autocomplete({ cancel: true });
          this.set("emojiPickerIsActive", true);
          return "";
        }
      },

      dataSource: (term) => {
        return new Promise((resolve) => {
          const full = `:${term}`;
          term = term.toLowerCase();

          if (term.length < this.siteSettings.emoji_autocomplete_min_chars) {
            return resolve(SKIP);
          }

          if (term === "") {
            if (this.emojiStore.favorites.length) {
              return resolve(this.emojiStore.favorites.slice(0, 5));
            } else {
              return resolve([
                "slight_smile",
                "smile",
                "wink",
                "sunny",
                "blush",
              ]);
            }
          }

          // note this will only work for emojis starting with :
          // eg: :-)
          const allTranslations = Object.assign(
            {},
            translations,
            this.getWithDefault("site.custom_emoji_translation", {})
          );
          if (allTranslations[full]) {
            return resolve([allTranslations[full]]);
          }

          const match = term.match(/^:?(.*?):t([2-6])?$/);
          if (match) {
            const name = match[1];
            const scale = match[2];

            if (isSkinTonableEmoji(name)) {
              if (scale) {
                return resolve([`${name}:t${scale}`]);
              } else {
                return resolve([2, 3, 4, 5, 6].map((x) => `${name}:t${x}`));
              }
            }
          }

          const options = emojiSearch(term, {
            maxResults: 5,
            diversity: this.emojiStore.diversity,
          });

          return resolve(options);
        })
          .then((list) =>
            list.map((code) => {
              return { code, src: emojiUrlFor(code) };
            })
          )
          .then((list) => {
            if (list.length) {
              list.push({ label: I18n.t("composer.more_emoji"), term });
            }
            return list;
          });
      },
    });
  },

  _focusTextArea(opts = { ensureAtEnd: false, resizeTextArea: true }) {
    schedule("afterRender", () => {
      if (!this.element || this.isDestroying || this.isDestroyed) {
        return;
      }

      if (!this._textarea) {
        return;
      }

      this._textarea.blur();
      this._textarea.focus();

      if (opts.resizeTextArea) {
        this._resizeTextArea();
      }

      if (opts.ensureAtEnd) {
        this._textarea.setSelectionRange(this.value.length, this.value.length);
      }
    });
  },

  _resizeTextArea() {
    this._textarea.parentNode.dataset.replicatedValue = this._textarea.value;

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

  @action
  sendClicked() {
    if (this.editingMessage) {
      this.internalEditMessage();
    } else {
      this.internalSendMessage();
    }
  },

  @action
  internalSendMessage() {
    if (this._messageIsValid()) {
      return this.sendMessage(this.value).then(() => this._reset());
    }
  },

  @action
  internalEditMessage() {
    if (this._messageIsValid()) {
      return this.editMessage(this.editingMessage, this.value).then(() =>
        this._reset()
      );
    }
  },

  _messageIsValid() {
    return this.canChat && !this._messageIsEmpty();
  },

  _messageIsEmpty() {
    return (this.value || "").trim() === "";
  },

  _reset() {
    this.set("value", "");
    this.onCancelEditing();
    this._focusTextArea();
  },

  @action
  cancelReplyTo() {
    this.set("replyToMsg", null);
  },
});
