import Component from "@ember/component";
import UppyMediaOptimization from "discourse/lib/uppy-media-optimization-plugin";
import ComposerUploadUppy from "discourse/mixins/composer-upload-uppy";
import discourseComputed from "discourse-common/utils/decorators";
import I18n from "I18n";
import TextareaTextManipulation from "discourse/mixins/textarea-text-manipulation";
import userSearch from "discourse/lib/user-search";
import {
  authorizedExtensions,
  authorizesAllExtensions,
} from "discourse/lib/uploads";
import { action } from "@ember/object";
import { cancel, schedule, throttle } from "@ember/runloop";
import { categoryHashtagTriggerRule } from "discourse/lib/category-hashtags";
import { findRawTemplate } from "discourse-common/lib/raw-templates";
import { emojiSearch, isSkinTonableEmoji } from "pretty-text/emoji";
import { emojiUrlFor } from "discourse/lib/text";
import { inject as service } from "@ember/service";
import { or } from "@ember/object/computed";
import { search as searchCategoryTag } from "discourse/lib/category-tag-search";
import { SKIP } from "discourse/lib/autocomplete";
import { Promise } from "rsvp";
import { translations } from "pretty-text/emoji/data";

const THROTTLE_MS = 150;
let outsideToolbarClick;

const toolbarButtons = [];
export function addChatToolbarButton(toolbarButton) {
  toolbarButtons.push(toolbarButton);
}

export default Component.extend(TextareaTextManipulation, ComposerUploadUppy, {
  classNames: ["tc-composer"],
  emojiStore: service("emoji-store"),
  editingMessage: null,
  fullPage: false,
  mediaOptimizationWorker: service(),
  onValueChange: null,
  previewing: false,
  showToolbar: false,
  timer: null,
  value: "",

  // Composer Uppy values
  ready: true,
  eventPrefix: "chat-composer",
  composerModel: null,
  composerModelContentKey: "value",
  editorInputClass: ".tc-composer-input",
  showCancelBtn: or("isUploading", "isProcessingUpload"),
  uploadCancelled: false,
  uploadProcessorActions: null,
  uploadPreProcessors: null,
  uploadMarkdownResolvers: null,
  uploadType: "chat-composer",
  uppyId: "chat-composer-uppy",

  @discourseComputed("fullPage")
  fileUploadElementId(fullPage) {
    return fullPage ? "chat-full-page-uploader" : "chat-widget-uploader";
  },

  @discourseComputed("fullPage")
  mobileFileUploaderId(fullPage) {
    return fullPage
      ? "chat-full-page-mobile-uploader"
      : "chat-widget-mobile-uploader";
  },

  _findMatchingUploadHandler() {
    return;
  },

  init() {
    this._super(...arguments);

    this.setProperties({
      uploadProcessorActions: {},
      uploadPreProcessors: [],
      uploadMarkdownResolvers: [],
    });
    outsideToolbarClick = this.toggleToolbar.bind(this);

    this.set(
      "toolbarButtons",
      [
        {
          action: this.uploadClicked,
          class: "upload-btn",
          id: this.mobileFileUploaderId,
          icon: "far-image",
          title: "chat.upload",
        },
      ].concat(toolbarButtons)
    );

    if (this.siteSettings.composer_media_optimization_image_enabled) {
      // TODO:
      // This whole deal really is not ideal, maybe we need some sort
      // of ComposerLike mixin that handles adding these processors? But
      // then again maybe not, because we may not want all processors
      // for chat...
      this.uploadPreProcessors.push({
        pluginClass: UppyMediaOptimization,
        optionsResolverFn: ({ isMobileDevice }) => {
          return {
            optimizeFn: (data, opts) =>
              this.mediaOptimizationWorker.optimizeImage(data, opts),
            runParallel: !isMobileDevice,
          };
        },
      });
    }
  },

  didInsertElement() {
    this._super(...arguments);
    this.set("composerModel", this);

    this._textarea = this.element.querySelector(".tc-composer-input");
    this._$textarea = $(this._textarea);
    this._applyCategoryHashtagAutocomplete(this._$textarea);
    this._applyEmojiAutocomplete(this._$textarea);
    this._bindUploadTarget();

    this.appEvents.on(`${this.eventPrefix}:insert-text`, this, "_insertText");
    this.appEvents.on(`${this.eventPrefix}:replace-text`, this, "_replaceText");
  },

  willDestroyElement() {
    this._super(...arguments);
    window.removeEventListener("click", outsideToolbarClick);

    if (this.timer) {
      cancel(this.timer);
      this.timer = null;
    }

    this.setProperties({
      uploadPreProcessors: null,
      uploadProcessorActions: null,
      uploadMarkdownResolvers: null,
    });

    this.appEvents.off(`${this.eventPrefix}:insert-text`, this, "_insertText");
    this.appEvents.off(
      `${this.eventPrefix}:replace-text`,
      this,
      "_replaceText"
    );
  },

  didRender() {
    this._super(...arguments);
    if (this._messageIsEmpty() && !this.site.mobileView) {
      this._focusTextArea();
    }
  },

  keyDown(event) {
    if (this.site.mobileView) {
      return;
    }

    if (event.keyCode === 13) {
      // keyCode for 'Enter'
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
    }
  },

  @action
  cancelEditing() {
    this.set("value", "");
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
        this.onValueChange(value);
      },
      THROTTLE_MS
    );
  },

  @action
  uploadClicked() {
    this.element.querySelector(`#${this.fileUploadElementId}`).click();
  },

  _applyUserAutocomplete() {
    if (this.siteSettings.enable_mentions) {
      $(this._textarea).autocomplete({
        template: findRawTemplate("user-selector-autocomplete"),
        key: "@",
        width: "100%",
        treatAsTextarea: true,
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
      key: ":",
      afterComplete: (text) => {
        this.set("value", text);
        this._focusTextArea();
      },
      treatAsTextarea: true,

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

  addText(text) {
    const selected = this._getSelected(null, {
      lineVal: true,
    });
    this._addText(selected, text);
  },

  @action
  onEmojiSelected(code) {
    this.emojiSelected(code);
    this.set("emojiPickerIsActive", false);
  },

  @discourseComputed("previewing")
  placeholder(previewing) {
    return I18n.t(
      previewing ? "chat.placeholder_previewing" : "chat.placeholder"
    );
  },

  @discourseComputed("isUploading", "isProcessingUpload", "previewing")
  inputDisabled(uploading, processingUpload, previewing) {
    return uploading || processingUpload || previewing;
  },

  @discourseComputed("value", "loading")
  sendDisabled(value, loading) {
    return (value || "").trim() === "" || loading || this.inputDisabled;
  },

  @action
  sendClicked() {
    if (this.sendDisabled) {
      return;
    }

    this.editingMessage
      ? this.internalEditMessage()
      : this.internalSendMessage();
  },

  @action
  internalSendMessage() {
    if (this._messageIsValid()) {
      return this.sendMessage(this.value).then(() => this._resetTextarea());
    }
  },

  @action
  internalEditMessage() {
    if (this._messageIsValid()) {
      return this.editMessage(this.editingMessage, this.value).then(() =>
        this._resetTextarea()
      );
    }
  },

  _messageIsValid() {
    return !this._messageIsEmpty();
  },

  _messageIsEmpty() {
    return (this.value || "").trim() === "";
  },

  _resetTextarea() {
    this.set("value", "");
    this.onCancelEditing();
    this._focusTextArea();
  },

  @action
  cancelReplyTo() {
    this.set("replyToMsg", null);
  },

  @discourseComputed()
  acceptedFormats() {
    const extensions = authorizedExtensions(
      this.currentUser.staff,
      this.siteSettings
    );

    return extensions.map((ext) => `.${ext}`).join();
  },
  @discourseComputed()
  acceptsAllFormats() {
    return authorizesAllExtensions(this.currentUser.staff, this.siteSettings);
  },

  _cursorIsOnEmptyLine() {
    const selectionStart = this._textarea.selectionStart;
    if (selectionStart === 0) {
      return true;
    } else if (this._textarea.value.charAt(selectionStart - 1) === "\n") {
      return true;
    } else {
      return false;
    }
  },

  @action
  cancelUploads() {
    this.set("uploadCancelled", true);
  },

  @action
  toggleToolbar() {
    this.set("showToolbar", !this.showToolbar);
    if (this.showToolbar) {
      window.addEventListener("click", outsideToolbarClick);
    } else {
      window.removeEventListener("click", outsideToolbarClick);
    }
    return false;
  },
});
