import { withPluginApi } from "discourse/lib/plugin-api";

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
    });
  },
};
