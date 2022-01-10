import Component from "@ember/component";
import { action, computed } from "@ember/object";
import escape from "discourse-common/lib/escape";
import domFromString from "discourse-common/lib/dom-from-string";
import I18n from "I18n";

export default Component.extend({
  collapsed: false,
  uploads: null,
  cooked: null,
  message: null,

  @computed("uploads")
  get imageFilename() {
    if (this.uploads) {
      if (this.uploads.length === 1) {
        return this.uploads[0].original_filename;
      } else {
        return I18n.t(`chat.uploaded_files`, { count: this.uploads.length });
      }
    }
  },

  @computed("cooked")
  get youtubeTitle() {
    return domFromString(this.cooked).dataset.youtubeTitle;
  },

  @computed("cooked")
  get youtubeLink() {
    const id = domFromString(this.cooked).dataset.youtubeId;
    return `https://www.youtube.com/watch?v=${escape(id)}`;
  },

  @action
  open() {
    this.set("collapsed", false);
  },

  @action
  close() {
    this.set("collapsed", true);
  },

  @computed("cooked")
  get isYoutube() {
    return isYoutube(this.cooked);
  },

  @computed("uploads", "cooked")
  get isImage() {
    return isImage(this.uploads, this.cooked);
  },

  @computed("cooked", "message")
  get isAnimatedImage() {
    return isAnimatedImage(this.cooked, this.message);
  },
});

function isYoutube(cooked) {
  return /^<div class="onebox lazyYT lazyYT-container"/.test(cooked);
}

function isAnimatedImage(cooked, message) {
  const onebox = `<p><img src="${escape(message)}" class="animated onebox"`;
  return cooked.startsWith(onebox);
}

function isImage(uploads) {
  return uploads?.length > 0;
}

export function isCollapsible(cooked, uploads, message) {
  return (
    isYoutube(cooked) || isAnimatedImage(cooked, message) || isImage(uploads)
  );
}
