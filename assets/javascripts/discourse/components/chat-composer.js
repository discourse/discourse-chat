import I18n from "I18n";
import Component from "@ember/component";
import discourseComputed, { observes } from "discourse-common/utils/decorators";
import userSearch from "discourse/lib/user-search";
import { action } from "@ember/object";
import { cancel, later, schedule, throttle  } from "@ember/runloop";
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

export default Component.extend({
  classNames: ["tc-composer"],
  value: "",
  sendIcon: "play",
  sendTitle: "chat.send",
  emojiStore: service("emoji-store"),

  timer: null,

  didInsertElement() {
    this._super(...arguments);
    this.set("textarea", this.element.querySelector(".tc-composer-input"));
    this.textarea.rows = 1;
    const $textarea = $(this.textarea);
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
        this._applyUserAutocomplete();
      },
      150
    );
  },

  _applyUserAutocomplete() {
    if (this.siteSettings.enable_mentions) {
      $(this.textarea).autocomplete({
        template: findRawTemplate("user-selector-autocomplete"),
        key: "@",
        width: "100%",
        treatAsTextarea: true,
        autoSelectFirstSuggestion: true,
        transformComplete: (v) => v.username || v.name,
        dataSource: (term) => userSearch({ term, includeGroups: false }),
        modifiers: [
          {
            name: "eventListeners",
            options: { scroll: false },
          },
        ],
      });
    }
  },

  _applyCategoryHashtagAutocomplete($textarea) {
    const siteSettings = this.siteSettings;

    $textarea.autocomplete({
      template: findRawTemplate("category-tag-autocomplete"),
      key: "#",
      treatAsTextarea: true,
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
      treatAsTextarea: true,
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

          schedule("afterRender", () => {
            const filterInput = document.querySelector(
              ".emoji-picker input[name='filter']"
            );
            if (filterInput) {
              filterInput.value = v.term;

              later(() => filterInput.dispatchEvent(new Event("input")), 50);
            }
          });

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

  _focusTextArea() {
    schedule("afterRender", () => {
      if (!this.element || this.isDestroying || this.isDestroyed) {
        return;
      }

      if (!this.textarea) {
        return;
      }

      this.textarea.blur();
      this.textarea.focus();
    });
  },

  _setMinHeight() {
    const textarea = this.textarea;
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
