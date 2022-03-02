import { createWidget } from "discourse/widgets/widget";
import ChatChannel from "discourse/plugins/discourse-chat/discourse/models/chat-channel";
import { iconNode } from "discourse-common/lib/icon-library";

export default createWidget("topic-title-chat-link", {
  tagName: "span.topic-title-chat-link",
  title: "chat.open",

  html() {
    return iconNode("far-comments");
  },

  buildClasses(attrs) {
    if (attrs.closed || !attrs.has_chat_live) {
      return "hidden";
    }
  },

  click() {
    this.appEvents.trigger(
      "chat:open-channel-for-chatable",
      ChatChannel.create(this.attrs.chat_channel)
    );
  },
});
