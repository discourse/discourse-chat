import { createWidget } from "discourse/widgets/widget";
import { h } from "virtual-dom";
import { iconNode } from "discourse-common/lib/icon-library";

export default createWidget("header-chat-link", {
  chatService: null,
  tagName: "li.header-dropdown-toggle.open-chat",
  title: "chat.title",
  init() {
    this.chatService = this.register.lookup("service:chat");
  },
  html(attrs) {
    let contents = [
      h(
        `a.icon${this.chatService.getChatOpenStatus() ? ".active" : ""}`,
        iconNode("comment")
      ),
    ];
    if (this.chatService.getHasUnreadMessages()) {
      contents.push(h("div.unread-chat-messages-indicator"));
    }
    return contents;
  },
  click() {
    this.appEvents.trigger("chat:toggle-open");
  },
  didRenderWidget() {
    this.appEvents.on("chat:rerender-header", this, "scheduleRerender");
  },
  willRerenderWidget() {
    this._stopAppEvents();
  },
  destroy() {
    this._stopAppEvents();
  },
  _stopAppEvents() {
    this.appEvents.off("chat:rerender-header", this, "scheduleRerender");
  },
});
