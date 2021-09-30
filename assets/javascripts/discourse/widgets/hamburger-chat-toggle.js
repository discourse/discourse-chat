import { createWidget } from "discourse/widgets/widget";
import { iconNode } from "discourse-common/lib/icon-library";

export default createWidget("hamburger-chat-toggle", {
  tagName: "li.hamburger-chat-toggle",
  title: "chat.open",

  html() {
    return "Chat";
  },

  click() {
    console.log("hello")
  },
});
