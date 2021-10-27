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
    const unreadUrgentCount = this.chat.getUnreadUrgentCount();
    let indicator;
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

    return [
      h(
        `a.icon${
          this.onChatPage() || this.chat.getChatOpenStatus() ? ".active" : ""
        }`,
        [iconNode("comment"), indicator].filter(Boolean)
      ),
    ];
  },

  onChatPage() {
    return (
      this.router.currentRouteName === "chat" ||
      this.router.currentRouteName === "chat.channel"
    );
  },

  mouseDown(e) {
    if (e.which === 2) {
      // Middle mouse click
      window.open("/chat", "_blank").focus();
    }
  },

  click() {
    if (this.onChatPage()) {
      return;
    }

    if (this.site.mobileView || this.chat.getSidebarActive()) {
      DiscourseURL.routeTo("/chat");
    } else {
      this.appEvents.trigger("chat:toggle-open");
    }
  },

  chatRerenderHeader() {
    this.scheduleRerender();
  },
});
