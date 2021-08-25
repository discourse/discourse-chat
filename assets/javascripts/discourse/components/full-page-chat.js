import Component from "@ember/component";
import discourseComputed from "discourse-common/utils/decorators";
import { action } from "@ember/object";

export default Component.extend({
  tagName: '',
  teamsSidebarOn: false,

  init() {
    this._super(...arguments);
    const sidebarWrapper = document.querySelector('.sidebar-wrapper')
    if (sidebarWrapper) {
      this.set("teamsSidebarOn", true)
    }
  },

  @discourseComputed("teamsSidebarOn")
  wrapperClassNames(teamsSidebarOn) {
    const classNames = ["full-page-chat"]
    if (teamsSidebarOn) {
      classNames.push("teams-sidebar-on")
    }
    return classNames.join(" ")
  },

  didInsertElement() {
    this._super(...arguments);

    this._calculateHeight();
    window.addEventListener("resize", this._calculateHeight, false);
  },

  willDestroyElement() {
    this._super(...arguments);
    window.removeEventListener("resize", this._calculateHeight, false);
  },

  _calculateHeight() {
    const main = document.querySelector("#main-outlet"),
      padBottom = window
        .getComputedStyle(main, null)
        .getPropertyValue("padding-bottom"),
      chatContainerCoords = document
        .querySelector(".full-page-chat")
        .getBoundingClientRect();

    const elHeight =
      window.innerHeight - chatContainerCoords.y - parseInt(padBottom, 10) - 10;
    document.body.style.setProperty("--full-page-chat-height", `${elHeight}px`);
  },


  @action
  switchChannel() {
    console.log("here")
  }
})
