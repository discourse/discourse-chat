import DiscourseURL from "discourse/lib/url";
import { createWidget } from "discourse/widgets/widget";
import { h } from "virtual-dom";
import { iconNode } from "discourse-common/lib/icon-library";

export default createWidget("header-chat-link", {
  buildKey: () => "header-chat-link",
  chat: null,
  tagName: "li.header-dropdown-toggle.open-chat",
  title: "chat.title",
  services: ["chat", "router"],

  html() {
    if (!this.currentUser?.has_chat_enabled) {
      return;
    }

    if (
      this.currentUser.isInDoNotDisturb() ||
      (this.currentUser.chat_isolated && !this.chat.onChatPage())
    ) {
      return this.chatLinkHtml();
    }

    let indicator;
    let unreadUrgentCount = this.chat.getUnreadUrgentCount();
    if (unreadUrgentCount) {
      indicator = h(
        "div.chat-unread-urgent-indicator",
        {},
        h(
          "div.chat-unread-urgent-indicator-number-wrap",
          {},
          h("div.chat-unread-urgent-indicator-number", {}, unreadUrgentCount)
        )
      );
    } else if (this.chat.getHasUnreadMessages()) {
      indicator = h("div.chat-unread-indicator");
    }

    return this.chatLinkHtml(indicator);
  },

  chatLinkHtml(indicatorNode) {
    return h(
      `a.icon${
        this.chat.onChatPage() || this.chat.getChatOpenStatus() ? ".active" : ""
      }`,
      [iconNode("comment"), indicatorNode].filter(Boolean)
    );
  },

  mouseDown(e) {
    if (e.which === 2) {
      // Middle mouse click
      window.open("/chat", "_blank").focus();
    }
  },

  click() {
    if (this.chat.onChatPage()) {
      return;
    }

    if (
      this.site.mobileView ||
      this.chat.getSidebarActive() ||
      this.currentUser.chat_isolated
    ) {
      DiscourseURL.routeTo("/chat");
    } else {
      this.appEvents.trigger("chat:toggle-open");
    }
  },

  chatRerenderHeader() {
    this.scheduleRerender();
  },
});
