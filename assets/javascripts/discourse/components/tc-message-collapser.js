import Component from "@ember/component";
import { action } from "@ember/object";
import escape from "discourse-common/lib/escape";

export default Component.extend({
  collapsed: false,
  cooked: null,
  link: null,
  title: null,

  init() {
    this._super(...arguments);

    const cookedElement = new DOMParser().parseFromString(
      this.cooked,
      "text/xml"
    ).firstChild;
    const title = cookedElement.getAttribute("data-youtube-title");
    const id = cookedElement.getAttribute("data-youtube-id");

    this.set("title", title);
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
