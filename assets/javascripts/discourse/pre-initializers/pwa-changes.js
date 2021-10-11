import { action } from "@ember/object";
import { PLUGIN_ID } from "discourse/plugins/discourse-topic-chat/discourse/initializers/chat-topic-changes";
import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "chat-pwa-changes",
  after: "inject-discourse-objects",

  initialize(container) {
    const currentUser = container.lookup("current-user:main");
    console.log(currentUser.has_chat_enabled)
    if (!currentUser?.has_chat_enabled) {
      return;
    }

    withPluginApi("0.12.1", (api) => {
      const chat = container.lookup("service:chat");
      const isPWA =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone ||
        document.referrer.includes("android-app://");
      chat.setIsPWA(isPWA);

      console.log("HERE")
      api.unsubscribeFromNotifications();
      if (isPWA) {
        document.body.classList.add("chat-pwa");

        api.unsubscribeFromNotifications();
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
