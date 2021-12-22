import { withPluginApi } from "discourse/lib/plugin-api";

export const CHAT_SOUNDS = {
  bell: "/plugins/discourse-chat/audio/bell.mp3",
  ding: "/plugins/discourse-chat/audio/ding.mp3",
};

export default {
  name: "chat-notification-sounds",
  initialize(container) {
    const currentUser = container.lookup("current-user:main");
    if (!currentUser?.has_chat_enabled || !currentUser?.chat_sound) {
      return;
    }

    withPluginApi("0.12.1", (api) => {
      api.registerDesktopNotificationHandler((data, siteSettings, user) => {
        // chat_mention and chat_message are notification_types of 29 and 30.
        if ([29, 30].includes(data.notification_type)) {
          const audio = new Audio(CHAT_SOUNDS[user.chat_sound]);
          audio.volume = 0.8;
          audio.play();
        }
      });
    });
  },
};
