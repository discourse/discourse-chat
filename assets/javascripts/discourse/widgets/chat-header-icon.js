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
    return [
      h(
        `a.icon${this.chat.getChatOpenStatus() ? ".active" : ""}`,
        [
          iconNode("comment"),
          this.chat.getHasUnreadMessages() &&
            h("div.unread-chat-messages-indicator"),
        ].filter(Boolean)
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
