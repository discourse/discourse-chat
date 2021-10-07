import { withPluginApi } from "discourse/lib/plugin-api";
import { action } from '@ember/object';

export default {
  name: "chat-topic-is-pwa-check",
  initialize(container) {
    const currentUser = container.lookup("current-user:main");
    if (!currentUser?.has_chat_enabled) {
      return;
    }

    withPluginApi("0.12.1", (api) => {
      const chat = container.lookup("service:chat");
      const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator.standalone) || document.referrer.includes('android-app://');
      chat.setIsPWA(isPWA)
      if (isPWA) {
        document.body.classList.add("chat-pwa")

        api.modifyClass("route:application", {
          @action
          willTransition(transition) {
            if (transition.to.name !== "chat" && transition.to.name !== "chat.channel") {
              window.open(transition.intent.url)
              transition.abort();
            }
          }
        });
      }
    })

  }
}
