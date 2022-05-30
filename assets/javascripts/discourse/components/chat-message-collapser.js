import Component from "@ember/component";
import { computed } from "@ember/object";
import { htmlSafe } from "@ember/template";
import escape from "discourse-common/lib/escape";
import domFromString from "discourse-common/lib/dom-from-string";
import I18n from "I18n";

export default class ChatMessageCollapser extends Component {
  tagName = "";
  collapsed = false;
  uploads = null;
  cooked = null;

  @computed("uploads")
  get hasUploads() {
    return hasUploads(this.uploads);
  }

  @computed("uploads")
  get uploadsHeader() {
    let name = "";
    if (this.uploads.length === 1) {
      name = this.uploads[0].original_filename;
    } else {
      name = I18n.t("chat.uploaded_files", { count: this.uploads.length });
    }
    return `<span class="chat-message-collapser-link-small">${name}</span>`;
  }

  @computed("cooked")
  get cookedBodies() {
    const elements = Array.prototype.slice.call(domFromString(this.cooked));

    if (hasYoutube(elements)) {
      return this.youtubeCooked(elements);
    }

    if (hasImageOnebox(elements)) {
      return this.imageOneboxCooked(elements);
    }

    if (hasImage(elements)) {
      return this.imageCooked(elements);
    }

    if (hasGallery(elements)) {
      return this.galleryCooked(elements);
    }

    return [];
  }

  youtubeCooked(elements) {
    return elements.reduce((acc, e) => {
      if (youtubePredicate(e)) {
        const id = e.dataset.youtubeId;
        const link = `https://www.youtube.com/watch?v=${escape(id)}`;
        const title = e.dataset.youtubeTitle;
        const header = htmlSafe(
          `<a target="_blank" class="chat-message-collapser-link" rel="noopener noreferrer" href="${link}">${title}</a>`
        );
        const body = document.createElement("div");
        body.className = "chat-message-collapser-youtube";
        body.appendChild(e);

        acc.push({ header, body, needsCollapser: true });
      } else {
        acc.push({ body: e, needsCollapser: false });
      }
      return acc;
    }, []);
  }

  imageOneboxCooked(elements) {
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
  }

  imageCooked(elements) {
    return elements.reduce((acc, e) => {
      if (imagePredicate(e)) {
        const link = e.firstElementChild.src;
        const alt = e.firstElementChild.alt;
        const header = htmlSafe(
          `<a target="_blank" class="chat-message-collapser-link-small" rel="noopener noreferrer" href="${link}">${
            alt || link
          }</a>`
        );
        acc.push({ header, body: e, needsCollapser: true });
      } else {
        acc.push({ body: e, needsCollapser: false });
      }
      return acc;
    }, []);
  }

  galleryCooked(elements) {
    return elements.reduce((acc, e) => {
      if (galleryPredicate(e)) {
        const link = e.firstElementChild.href;
        const title = e.firstElementChild.firstElementChild.textContent;
        e.firstElementChild.removeChild(e.firstElementChild.firstElementChild);
        const header = htmlSafe(
          `<a target="_blank" class="chat-message-collapser-link-small" rel="noopener noreferrer" href="${link}">${title}</a>`
        );
        acc.push({ header, body: e, needsCollapser: true });
      } else {
        acc.push({ body: e, needsCollapser: false });
      }
      return acc;
    }, []);
  }
}

function youtubePredicate(e) {
  return (
    e.classList.length &&
    e.classList.contains("onebox") &&
    e.classList.contains("lazyYT-container")
  );
}

function hasYoutube(elements) {
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

function hasImageOnebox(elements) {
  return elements.some((e) => imageOneboxPredicate(e));
}

function hasUploads(uploads) {
  return uploads?.length > 0;
}

function imagePredicate(e) {
  return (
    e.nodeName === "P" &&
    e.firstElementChild &&
    e.firstElementChild.nodeName === "IMG" &&
    !e.firstElementChild.classList.contains("emoji")
  );
}

function hasImage(elements) {
  return elements.some((e) => imagePredicate(e));
}

function galleryPredicate(e) {
  return (
    e.firstElementChild &&
    e.firstElementChild.nodeName === "A" &&
    e.firstElementChild.firstElementChild &&
    e.firstElementChild.firstElementChild.classList.contains("outer-box")
  );
}

function hasGallery(elements) {
  return elements.some((e) => galleryPredicate(e));
}

export function isCollapsible(cooked, uploads) {
  const elements = Array.prototype.slice.call(domFromString(cooked));

  return (
    hasYoutube(elements) ||
    hasImageOnebox(elements) ||
    hasUploads(uploads) ||
    hasImage(elements) ||
    hasGallery(elements)
  );
}
