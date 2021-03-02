import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "topic-chat-setup",
  initialize() {
    withPluginApi("0.11.0", (api) => {
      api.addPostMenuButton("chat-count", (attrs) => {
        if (!attrs.chat_enabled) {
          return {
            className: "hidden",
            disabled: "true",
          };
        }
        return {
          className: "button-count show-chat",
          contents: h("span", "9"), // TODO
          action: "showChat",
        };
      });
      api.addPostMenuButton("chat", (attrs) => {
        if (!attrs.chat_enabled) {
          return {
            className: "hidden",
            disabled: "true",
          };
        }
        return {
          className: "show-chat",
          before: "chat-count",
          action: "showChat",
          icon: "comment",
        };
      });
    });
  },
}
