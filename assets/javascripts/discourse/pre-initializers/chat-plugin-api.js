import { withPluginApi } from "discourse/lib/plugin-api";
import {
  addChatMessageDecorator,
  resetChatMessageDecorators,
} from "discourse/plugins/discourse-chat/discourse/components/chat-live-pane";

export default {
  name: "chat-plugin-api",
  after: "inject-discourse-objects",

  initialize() {
    withPluginApi("1.1.0", (api) => {
      Object.defineProperty(Object.getPrototypeOf(api), "decorateChatMessage", {
        value(decorator) {
          addChatMessageDecorator(decorator);
        },
      });
    });
  },

  teardown() {
    resetChatMessageDecorators();
  },
};
