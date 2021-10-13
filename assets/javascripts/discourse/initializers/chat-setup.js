import { withPluginApi } from "discourse/lib/plugin-api";
import {
  alertChannel,
  disable as disableDesktopNotifications,
  init as initDesktopNotifications,
  onNotification,
} from "discourse/lib/desktop-notifications";

function subscribeToChatNotifications(container, user) {
  const messageBus = container.lookup("message-bus:main");
  const siteSettings = container.lookup("site-settings:main");
  const appEvents = container.lookup("service:app-events");

  messageBus.subscribe(`/chat${alertChannel(user)}`, (data) =>
    onNotification(data, siteSettings, user)
  );
  initDesktopNotifications(messageBus, appEvents);
}

export default {
  name: "chat-setup",
  initialize(container) {
    const currentUser = container.lookup("current-user:main");
    if (!currentUser?.has_chat_enabled) {
      return;
    }
    subscribeToChatNotifications(container, currentUser);

    withPluginApi("0.12.1", (api) => {
      const chat = container.lookup("service:chat");
      chat.getChannels();

      api.addDocumentTitleCounter(() => chat.getChatDocumentTitleCount());
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
