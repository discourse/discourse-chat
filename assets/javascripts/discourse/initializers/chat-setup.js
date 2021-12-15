import { action } from "@ember/object";
import { withPluginApi } from "discourse/lib/plugin-api";
export const PLUGIN_ID = "discourse-chat";

export default {
  name: "chat-setup",
  initialize(container) {
    const currentUser = container.lookup("current-user:main");
    if (!currentUser?.has_chat_enabled) {
      return;
    }
    withPluginApi("0.12.1", (api) => {
      if (api.container.lookup("site:main").mobileView) {
        currentUser.chat_isolated = false;
      }

      const chat = container.lookup("service:chat");
      chat.getChannels();

      const chatNotificationManager = container.lookup(
        "service:chat-notification-manager"
      );
      chatNotificationManager.start();

      api.addDocumentTitleCounter(() => chat.getDocumentTitleCount());
      api.addCardClickListenerSelector(".topic-chat-float-container");

      api.dispatchWidgetAppEvent(
        "site-header",
        "header-chat-link",
        "chat:rerender-header"
      );

      api.dispatchWidgetAppEvent(
        "sidebar-header",
        "header-chat-link",
        "chat:rerender-header"
      );
      api.addToHeaderIcons("header-chat-link");

      if (currentUser.chat_isolated) {
        api.modifyClass("route:application", {
          pluginId: PLUGIN_ID,

          @action
          willTransition(transition) {
            this._super(...arguments);

            if (!currentUser.chat_isolated) {
              return;
            }

            const fromInsideChat = transition.from.name === "chat.channel";
            const toOutsideChat =
              transition.to.name !== "chat" &&
              transition.to.name !== "chat.channel";
            if (fromInsideChat && toOutsideChat) {
              window.open(transition.intent.url);
              transition.abort();
            }
          },
        });
      }
    });
  },
};
