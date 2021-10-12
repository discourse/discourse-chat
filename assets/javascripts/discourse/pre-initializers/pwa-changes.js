import { action } from "@ember/object";
import { PLUGIN_ID } from "discourse/plugins/discourse-topic-chat/discourse/initializers/chat-topic-changes";
import { withPluginApi } from "discourse/lib/plugin-api";
import {
  alertChannel,
  disable as disableDesktopNotifications,
  init as initDesktopNotifications,
  onNotification,
} from "discourse/lib/desktop-notifications";

export default {
  name: "chat-pwa-changes",
  after: "inject-discourse-objects",

  initialize(container) {
    const currentUser = container.lookup("current-user:main");
    if (!currentUser?.has_chat_enabled) {
      return;
    }
    subscribeToChatNotifications(container, currentUser);

    withPluginApi("0.12.6", (api) => {
      const chat = container.lookup("service:chat");
      const isPWA =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone ||
        document.referrer.includes("android-app://");
      chat.setIsPWA(isPWA);

      if (isPWA) {
        document.body.classList.add("chat-pwa");
        api.disableDefaultBadging();
        api.unsubscribeFromNotifications();
        addBadgingUpdates(container);
        api.modifyClass("route:application", {
          pluginId: PLUGIN_ID,

          @action
          willTransition(transition) {
            if (
              transition.to.name !== "chat" &&
              transition.to.name !== "chat.channel"
            ) {
              window.open(transition.intent.url);
              transition.abort();
            }
          },
        });
      }
    });
  },
};

function subscribeToChatNotifications(container, user) {
  const messageBus = container.lookup("message-bus:main");
  const siteSettings = container.lookup("site-settings:main");
  const appEvents = container.lookup("service:app-events");

  messageBus.subscribe(`/chat${alertChannel(user)}`, (data) =>
    onNotification(data, siteSettings, user)
  );
  initDesktopNotifications(messageBus, appEvents);
}

function addBadgingUpdates(container) {
  container.lookup("service:app-events").on("chat:rerender-header", () => {
    const chat = container.lookup("service:chat");
    let count = chat.getUnreadDirectMessageCount();
    if (count) {
      return navigator.setAppBadge(count);
    }

    if (chat.getHasUnreadMessages()) {
      navigator.setAppBadge(); // Shows a dot for unread messages
    } else {
      navigator.clearAppBadge();
    }
  });
}
