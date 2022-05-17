import { withPluginApi } from "discourse/lib/plugin-api";
import {
  addChatMessageDecorator,
  resetChatMessageDecorators,
} from "discourse/plugins/discourse-chat/discourse/components/chat-message";
import { registerChatComposerButton } from "discourse/plugins/discourse-chat/discourse/lib/chat-composer-buttons";

export default {
  name: "chat-plugin-api",
  after: "inject-discourse-objects",

  initialize() {
    withPluginApi("1.1.0", (api) => {
      const apiPrototype = Object.getPrototypeOf(api);

      if (!apiPrototype.hasOwnProperty("decorateChatMessage")) {
        Object.defineProperty(apiPrototype, "decorateChatMessage", {
          value(decorator) {
            addChatMessageDecorator(decorator);
          },
        });
      }

      if (!apiPrototype.hasOwnProperty("registerChatComposerButton")) {
        Object.defineProperty(apiPrototype, "registerChatComposerButton", {
          value(button) {
            registerChatComposerButton(button);
          },
        });
      }
    });
  },

  teardown() {
    resetChatMessageDecorators();
  },
};
