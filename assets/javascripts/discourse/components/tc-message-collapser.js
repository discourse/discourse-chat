import Component from "@ember/component";
import { action, computed } from "@ember/object";
import escape from "discourse-common/lib/escape";
import domFromString from "discourse-common/lib/dom-from-string";
import I18n from "I18n";

export default Component.extend({
  collapsed: false,
  uploads: null,
  cooked: null,

  @computed("cooked")
  get title() {
    return domFromString(this.cooked).dataset.youtubeTitle;
  },

  @computed("uploads")
  get filename() {
    if (this.uploads) {
      if (this.uploads.length === 1) {
        return this.uploads[0].original_filename;
      } else {
        return I18n.t(`chat.uploaded_files`, { count: this.uploads.length });
      }
    }
  },

  @computed("cooked")
  get link() {
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
});
