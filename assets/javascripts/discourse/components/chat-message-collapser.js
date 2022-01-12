import Component from "@ember/component";
import { computed } from "@ember/object";
import { htmlSafe } from "@ember/template";
import escape from "discourse-common/lib/escape";
import domFromString from "discourse-common/lib/dom-from-string";
import I18n from "I18n";

export default Component.extend({
  tagName: "",

  collapsed: false,
  uploads: null,
  cooked: null,

  @computed("cooked")
  get youtubeCooked() {
    const elements = Array.prototype.slice.call(domFromString(this.cooked));

    return elements.reduce((acc, e) => {
      if (youtubePredicate(e)) {
        const id = e.dataset.youtubeId;
        const link = `https://www.youtube.com/watch?v=${escape(id)}`;
        const title = e.dataset.youtubeTitle;
        const header = htmlSafe(
          `<a target="_blank" class="chat-message-collapser-link" rel="noopener noreferrer" href="${link}">${title}</a>`
        );
        acc.push({ header, body: e, needsCollapser: true });
      } else {
        acc.push({ body: e, needsCollapser: false });
      }
      return acc;
    }, []);
  },

  @computed("uploads")
  get uploadsHeader() {
    if (this.uploads.length === 1) {
      return this.uploads[0].original_filename;
    } else {
      return I18n.t("chat.uploaded_files", { count: this.uploads.length });
    }
  },

  @computed("cooked")
  get imageOneboxCooked() {
    const elements = Array.prototype.slice.call(domFromString(this.cooked));

    return elements.reduce((acc, e) => {
      if (imageOneboxPredicate(e)) {
        const link = animatedImagePredicate(e)
          ? e.firstChild.src
          : e.firstElementChild.href;
        const header = htmlSafe(
          `<a target="_blank" class="chat-message-collapser-link-small" rel="noopener noreferrer" href="${link}">${link}</a>`
        );
        acc.push({ header, body: e, needsCollapser: true });
      } else {
        acc.push({ body: e, needsCollapser: false });
      }
      return acc;
    }, []);
  },

  @computed("cooked")
  get hasYoutube() {
    return hasYoutube(this.cooked);
  },

  @computed("uploads")
  get hasUploads() {
    return hasUploads(this.uploads);
  },

  @computed("cooked")
  get hasImageOnebox() {
    return hasImageOnebox(this.cooked);
  },
});

function youtubePredicate(e) {
  return (
    e.classList.length &&
    e.classList.contains("onebox") &&
    e.classList.contains("lazyYT-container")
  );
}

function hasYoutube(cooked) {
  const elements = Array.prototype.slice.call(domFromString(cooked));
  return elements.some((e) => youtubePredicate(e));
}

function animatedImagePredicate(e) {
  return (
    e.firstChild &&
    e.firstChild.nodeName === "IMG" &&
    e.firstChild.classList.contains("animated") &&
    e.firstChild.classList.contains("onebox")
  );
}

function externalImageOnebox(e) {
  return (
    e.firstElementChild &&
    e.firstElementChild.nodeName === "A" &&
    e.firstElementChild.classList.contains("onebox") &&
    e.firstElementChild.firstElementChild &&
    e.firstElementChild.firstElementChild.nodeName === "IMG"
  );
}

function imageOneboxPredicate(e) {
  return animatedImagePredicate(e) || externalImageOnebox(e);
}

function hasImageOnebox(cooked) {
  const elements = Array.prototype.slice.call(domFromString(cooked));
  return elements.some((e) => imageOneboxPredicate(e));
}

function hasUploads(uploads) {
  return uploads?.length > 0;
}

export function isCollapsible(cooked, uploads) {
  return hasYoutube(cooked) || hasImageOnebox(cooked) || hasUploads(uploads);
}
