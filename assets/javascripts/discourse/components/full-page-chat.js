import Component from "@ember/component";
import discourseComputed, { bind } from "discourse-common/utils/decorators";
import { action } from "@ember/object";
import { reads } from "@ember/object/computed";
import { schedule } from "@ember/runloop";
import { inject as service } from "@ember/service";

export default Component.extend({
  tagName: "",
  teamsSidebarOn: reads("chat.sidebarActive"),
  router: service(),
  chat: service(),

  @discourseComputed("teamsSidebarOn")
  wrapperClassNames(teamsSidebarOn) {
    const classNames = ["full-page-chat"];
    if (teamsSidebarOn) {
      classNames.push("teams-sidebar-on");
    }
    return classNames.join(" ");
  },

  @discourseComputed("site.mobileView", "teamsSidebarOn")
  showChannelSelector(mobileView, sidebarOn) {
    return !mobileView && !sidebarOn;
  },

  init() {
    this._super(...arguments);

    this.appEvents.on("chat:refresh-channels", this, "refreshModel");
  },

  didInsertElement() {
    this._super(...arguments);

    this._scrollSidebarToBottom();
    window.addEventListener("resize", this._calculateHeight, false);
    document.addEventListener("keydown", this.autoFocusChatComposer);
    document.body.classList.add("has-full-page-chat");
    this.chat.set("fullScreenChatOpen", true);
    schedule("afterRender", this._calculateHeight);
  },

  willDestroyElement() {
    this._super(...arguments);

    this.appEvents.off("chat:refresh-channels", this, "refreshModel");
    window.removeEventListener("resize", this._calculateHeight, false);
    document.removeEventListener("keydown", this.autoFocusChatComposer);
    document.body.classList.remove("has-full-page-chat");
    this.chat.set("fullScreenChatOpen", false);
  },

  @bind
  autoFocusChatComposer(e) {
    if (!e.target || e.target.classList.contains("chat-composer-input")) {
      return;
    }

    if (!e.key || e.key.length > 1) {
      return; // Only care about single characters, unlike `Escape`
    }

    e.preventDefault();
    e.stopPropagation();

    const composer = document.querySelector(".chat-composer-input");
    if (composer) {
      this.appEvents.trigger("chat:insert-text", e.key);
      composer.focus();
    }
  },

  _scrollSidebarToBottom() {
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
      window.innerHeight -
      chatContainerCoords.y -
      window.pageYOffset -
      parseInt(padBottom, 10);

    document.body.style.setProperty("--full-page-chat-height", `${elHeight}px`);
  },

  @action
  navigateToIndex() {
    this.router.transitionTo("chat.index");
  },

  @action
  switchChannel(channel) {
    if (channel.id !== this.chatChannel.id) {
      this.router.transitionTo("chat.channel", channel.id, channel.title);
    }

    return false;
  },
});
