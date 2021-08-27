import DiscourseURL from "discourse/lib/url";
import { createWidget } from "discourse/widgets/widget";
import { h } from "virtual-dom";
import { iconNode } from "discourse-common/lib/icon-library";

export default createWidget("header-chat-link", {
  buildKey: () => "header-chat-link",
  chatService: null,
  tagName: "li.header-dropdown-toggle.open-chat",
  title: "chat.title",
  services: ["chat", "router"],

  html() {
    const unreadDmCount = this.chat.getUnreadDirectMessageCount();
    let indicator;
    if (unreadDmCount) {
      indicator = h(
        "div.unread-dm-indicator",
        {},
        h(
          "div.unread-dm-indicator-number-wrap",
          {},
          h("div.unread-dm-indicator-number", {}, unreadDmCount)
        )
      );
    } else if (this.chat.getHasUnreadMessages()) {
      indicator = h("div.unread-chat-messages-indicator");
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

  click() {
    if (this.onChatPage()) {
      return;
    }

    DiscourseURL.routeTo("/chat");
  },

  chatRerenderHeader() {
    this.scheduleRerender();
  },
});
