import Component from "@ember/component";
import discourseComputed from "discourse-common/utils/decorators";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";
import { next } from "@ember/runloop";

export default Component.extend({
  tagName: "",
  teamsSidebarOn: false,
  showingChannels: false,
  router: service(),
  chat: service(),

  @discourseComputed("teamsSidebarOn", "showingChannels")
  wrapperClassNames(teamsSidebarOn, showingChannels) {
    const classNames = ["full-page-chat"];
    if (teamsSidebarOn) {
      classNames.push("teams-sidebar-on");
    }
    if (showingChannels) {
      classNames.push("showing-channels");
    }
    return classNames.join(" ");
  },

  @discourseComputed("site.mobileView", "teamsSidebarOn", "showingChannels")
  showChannelSelector(mobileView, sidebarOn, showingChannels) {
    if (mobileView) {
      return showingChannels;
    }

    return !sidebarOn;
  },

  didInsertElement() {
    this._super(...arguments);

    this._scrollSidebarToBotton();
    window.addEventListener("resize", this._calculateHeight, false);
    this.set(
      "teamsSidebarOn",
      document.body.classList.contains("discourse-sidebar")
    );
    document.body.classList.add("has-full-page-chat");
    this.chat.setFullScreenChatOpenStatus(true);
    next(this._calculateHeight);
  },

  willDestroyElement() {
    this._super(...arguments);
    window.removeEventListener("resize", this._calculateHeight, false);
    document.body.classList.remove("has-full-page-chat");
    this.chat.setFullScreenChatOpenStatus(false);
  },

  _scrollSidebarToBotton() {
    if (!this.teamsSidebarOn) {
      return;
    }

    const sidebarScroll = document.querySelector(
      ".sidebar-container .scroll-wrapper"
    );
    if (sidebarScroll) {
      sidebarScroll.scrollTop = sidebarScroll.scrollHeight;
    }
  },

  _calculateHeight() {
    const main = document.getElementById("main-outlet"),
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
  switchChannel(channel) {
    this.set("showingChannels", false);

    if (channel.id !== this.chatChannel.id) {
      return this.router.transitionTo("chat.channel", channel.title);
    }
    return false;
  },
});
