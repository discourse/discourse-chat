import Component from "@ember/component";
import discourseComputed from "discourse-common/utils/decorators";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";

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

  init() {
    this._super(...arguments);
    this.appEvents.on("chat:refresh-channels", this, "refreshModel");
  },

  didInsertElement() {
    this._super(...arguments);

    this._scrollSidebarToBotton();
    document.body.classList.add("has-full-page-chat");
    this.chat.setFullScreenChatOpenStatus(true);
  },

  willDestroyElement() {
    this._super(...arguments);
    this.appEvents.off("chat:refresh-channels", this, "refreshModel");
    document.body.classList.remove("has-full-page-chat");
    this.chat.setFullScreenChatOpenStatus(false);
  },

  willRender() {
    this._super(...arguments);
    this.set("teamsSidebarOn", this.chat.getSidebarActive());
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

  @action
  switchChannel(channel) {
    this.set("showingChannels", false);

    if (channel.id !== this.chatChannel.id) {
      this.router.transitionTo("chat.channel", channel.id, channel.title);
    }
    return false;
  },
});
