import { createWidget } from "discourse/widgets/widget";
import { iconNode } from "discourse-common/lib/icon-library";

export default createWidget("topic-title-chat-link", {
  tagName: "span.topic-title-chat-link",
  title: "chat.open",

  html() {
    return iconNode("far-comments");
  },

  click() {
    this.appEvents.trigger("chat:open-channel", this.attrs);
  },
});
