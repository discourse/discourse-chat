import getURL from "discourse-common/lib/get-url";
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
    if (!this.chat.userCanChat) {
      return;
    }
    if (
      this.currentUser.isInDoNotDisturb() ||
      (this.currentUser.chat_isolated && !this.chat.isChatPage)
    ) {
      return this.chatLinkHtml();
    }

    let indicator;
    if (this.chat.unreadUrgentCount) {
      indicator = h(
        "div.chat-channel-unread-indicator.urgent",
        {},
        h(
          "div.number-wrap",
          {},
          h("div.number", {}, this.chat.unreadUrgentCount)
        )
      );
    } else if (this.chat.hasUnreadMessages) {
      indicator = h("div.chat-channel-unread-indicator");
    }

    return this.chatLinkHtml(indicator);
  },

  chatLinkHtml(indicatorNode) {
    return h(
      `a.icon${this.chat.isChatPage || this.chat.chatOpen ? ".active" : ""}`,
      { attributes: { tabindex: 0 } },
      [iconNode("comment"), indicatorNode].filter(Boolean)
    );
  },

  mouseDown(e) {
    if (e.which === 2) {
      // Middle mouse click
      window.open(getURL("/chat"), "_blank").focus();
    }
  },

  keyDown(e) {
    if (e.code === "Enter") {
      return this.click();
    }
  },

  click() {
    if (this.chat.isChatPage) {
      return;
    }

    if (this.currentUser.chat_isolated) {
      if (this.capabilities.isPwa) {
        return this.router.transitionTo("chat");
      } else {
        return window.open(getURL("/chat"), "_blank").focus();
      }
    }

    if (this.site.mobileView || this.chat.sidebarActive) {
      return this.router.transitionTo("chat");
    } else {
      this.appEvents.trigger("chat:toggle-open");
    }
  },

  chatRerenderHeader() {
    this.scheduleRerender();
  },
});
