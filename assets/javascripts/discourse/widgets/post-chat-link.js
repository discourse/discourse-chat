import I18n from "I18n";
import { createWidget } from "discourse/widgets/widget";
import { iconNode } from "discourse-common/lib/icon-library";

export default createWidget("post-chat-link", {
  tagName: "a.post-chat-link",
  title: "chat.open",
  services: ["chat"],
  loadingChat: false,

  html() {
    return [iconNode("comment"), I18n.t("chat.from_chat")];
  },

  click() {
    this.chat.openChannelAtMessage(
      this.attrs.chat_connection.chat_channel_id,
      this.attrs.chat_connection.chat_message_ids[0]
    );
  },
});
