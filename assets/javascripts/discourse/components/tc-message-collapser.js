import Component from "@ember/component";
import { action } from "@ember/object";
import escape from "discourse-common/lib/escape";
import domFromString from "discourse-common/lib/dom-from-string";

export default Component.extend({
  collapsed: false,
  cooked: null,
  link: null,
  title: null,

  init() {
    this._super(...arguments);

    const cookedElement = domFromString(this.cooked);

    const title = cookedElement.dataset.youtubeTitle;
    this.set("title", title);

    const id = cookedElement.dataset.youtubeId;
    this.set("link", `https://www.youtube.com/watch?v=${escape(id)}`);
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
