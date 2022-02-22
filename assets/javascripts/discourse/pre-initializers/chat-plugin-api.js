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
      const apiPrototype = Object.getPrototypeOf(api);

      if (apiPrototype.hasOwnProperty("decorateChatMessage")) {
        return;
      }

      Object.defineProperty(apiPrototype, "decorateChatMessage", {
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
