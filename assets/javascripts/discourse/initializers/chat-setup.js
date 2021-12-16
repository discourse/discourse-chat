import { action } from "@ember/object";
import { withPluginApi } from "discourse/lib/plugin-api";
import { next } from "@ember/runloop";
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
        const router = container.lookup("service:router");
        router.on("routeWillChange", (transition) => {
          if (!currentUser.chat_isolated) {
            return;
          }
          const from = transition?.from;
          if (from?.name !== "chat.channel") {
            return;
          }

          const to = transition.to;
          if (
            to.name &&
            !to.name.startsWith("chat.") &&
            !to.name.startsWith("preferences.")
          ) {
            transition.abort();
            window.open(transition.intent.url);
            next(() => {
              let originalUrl;
              if (to.paramNames.length > 0) {
                originalUrl = router.urlFor(from.name, from.params);
              } else {
                originalUrl = router.urlFor(from.name);
              }
              history.replaceState({}, "", originalUrl);
            });
            return false;
          }
        });
      }
    });
  },
};
