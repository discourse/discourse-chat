import { createWidget } from "discourse/widgets/widget";
import { h } from "virtual-dom";
import { iconNode } from "discourse-common/lib/icon-library";

export default createWidget("header-chat-link", {
  buildKey: () => "header-chat-link",
  chatService: null,
  tagName: "li.header-dropdown-toggle.open-chat",
  title: "chat.title",
  services: ["chat"],

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
        `a.icon${this.chat.getChatOpenStatus() ? ".active" : ""}`,
        [iconNode("comment"), indicator].filter(Boolean)
      ),
    ];
  },

  click() {
    this.appEvents.trigger("chat:toggle-open");
  },

  chatRerenderHeader() {
    this.scheduleRerender();
  },
});
