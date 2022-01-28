import Component from "@ember/component";
import discourseComputed from "discourse-common/utils/decorators";
import { action } from "@ember/object";
import { reads } from "@ember/object/computed";
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

  didInsertElement() {
    this._super(...arguments);

    this.appEvents.on("chat:refresh-channels", this, "refreshModel");
    this._scrollSidebarToBottom();
    document.body.classList.add("has-full-page-chat");
    this.chat.set("fullScreenChatOpen", true);
  },

  willDestroyElement() {
    this._super(...arguments);

    this.appEvents.off("chat:refresh-channels", this, "refreshModel");
    document.body.classList.remove("has-full-page-chat");
    this.chat.set("fullScreenChatOpen", false);
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
