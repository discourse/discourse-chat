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
    this.appEvents.on("chat:refresh-channel", this, "_refreshChannel");
  },

  didInsertElement() {
    this._super(...arguments);

    this._scrollSidebarToBottom();
    window.addEventListener("resize", this._calculateHeight, false);
    document.addEventListener("keydown", this._autoFocusChatComposer);
    document.body.classList.add("has-full-page-chat");
    this.chat.set("fullScreenChatOpen", true);
    schedule("afterRender", this._calculateHeight);
    this.appEvents.on("composer:resized", this, "_calculateHeight");
    this.appEvents.on("chat:window-visible", this, "_calculateHeight");
  },

  willDestroyElement() {
    this._super(...arguments);

    this.appEvents.off("chat:refresh-channels", this, "refreshModel");
    this.appEvents.off("chat:refresh-channel", this, "_refreshChannel");
    window.removeEventListener("resize", this._calculateHeight, false);
    document.removeEventListener("keydown", this._autoFocusChatComposer);
    document.body.classList.remove("has-full-page-chat");
    this.chat.set("fullScreenChatOpen", false);
    this.appEvents.off("composer:resized", this, "_calculateHeight");
    this.appEvents.off("chat:window-visible", this, "_calculateHeight");
  },

  @bind
  _autoFocusChatComposer(event) {
    if (
      !event.key ||
      // Handles things like Enter, Tab, Shift
      event.key.length > 1 ||
      // Don't need to focus if the user is beginning a shortcut.
      event.metaKey ||
      event.ctrlKey ||
      // Space's key comes through as ' ' so it's not covered by event.key
      event.code === "Space" ||
      // ? is used for the keyboard shortcut modal
      event.key === "?"
    ) {
      return;
    }

    if (
      !event.target ||
      /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const composer = document.querySelector(".chat-composer-input");
    if (composer && !this.chatChannel.isDraft) {
      this.appEvents.trigger("chat:insert-text", event.key);
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

  _refreshChannel(channelId) {
    if (this.chatChannel.id === channelId) {
      this.refreshModel(true);
    }
  },

  @action
  navigateToIndex() {
    this.router.transitionTo("chat.index");
  },

  @action
  switchChannel(channel, options = {}) {
    options = Object.assign({}, { replace: false, transition: true }, options);

    if (options.replace) {
      this.set("chatChannel", null);
      this.set("chatChannel", channel);
    }

    if (
      options.transition &&
      (options.replace || channel.id !== this.chatChannel?.id)
    ) {
      return this.chat.openChannel(channel);
    }
  },
});
