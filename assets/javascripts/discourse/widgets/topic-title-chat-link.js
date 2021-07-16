import { createWidget } from "discourse/widgets/widget";
import { h } from "virtual-dom";
import { iconNode } from "discourse-common/lib/icon-library";
import I18n from "I18n";

export default createWidget("topic-title-chat-link", {
  tagName: "span.topic-title-chat-link",
  title: "chat.open",

  html(topic) {
    return iconNode("far-comments");
  },

  click() {
    this.appEvents.trigger("chat:open-channel", this.attrs);
  },
});
