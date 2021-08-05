import { createWidget } from "discourse/widgets/widget";
import { h } from "virtual-dom";
import { iconNode } from "discourse-common/lib/icon-library";

export default createWidget("header-chat-link", {
  buildKey: () => 'header-chat-link',
  chatService: null,
  tagName: "li.header-dropdown-toggle.open-chat",
  title: "chat.title",
  services: ["chat"],
  html() {
    let contents = [
      h(
        `a.icon${this.chat.getChatOpenStatus() ? ".active" : ""}`,
        iconNode("comment")
      ),
    ];
    if (this.chat.getHasUnreadMessages()) {
      contents.push(h("div.unread-chat-messages-indicator"));
    }
    return contents;
  },
  click() {
    this.appEvents.trigger("chat:toggle-open");
  },
  chatRerenderHeader() {
    this.scheduleRerender();
  },
});
