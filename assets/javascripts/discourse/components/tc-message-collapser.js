import Component from "@ember/component";
import { action, computed } from "@ember/object";
import escape from "discourse-common/lib/escape";
import domFromString from "discourse-common/lib/dom-from-string";

export default Component.extend({
  collapsed: false,
  uploads: null,
  cooked: null,

  @computed("cooked")
  get title() {
    return domFromString(this.cooked).dataset.youtubeTitle;
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
