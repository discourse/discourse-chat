import { withPluginApi } from "discourse/lib/plugin-api";

export const CHAT_SOUNDS = {
  bell: "/plugins/discourse-chat/audio/bell.mp3",
  ding: "/plugins/discourse-chat/audio/ding.mp3",
};

function sendTauriNotification(tauriNotification, data) {
  tauriNotification.sendNotification({
    title: data.translated_title,
    body: data.excerpt,
  });
}

export default {
  name: "chat-notification-enhancements",
  initialize(container) {
    const currentUser = container.lookup("current-user:main");
    if (!currentUser?.has_chat_enabled) {
      return;
    }

    withPluginApi("0.12.1", (api) => {
      api.registerDesktopNotificationHandler(
        async (data, siteSettings, user) => {
          // chat_mention and chat_message are notification_types of 29 and 30.
          if ([29, 30].includes(data.notification_type)) {
            // Opt-in Sounds Notifications
            if (!currentUser?.chat_sound) {
              const audio = new Audio(CHAT_SOUNDS[user.chat_sound]);
              audio.play();
            }

            // Desktop app notifications
            const tauriNotification = window?.__TAURI__?.notification;
            if (tauriNotification) {
              const tauriNotificationPermission = await tauriNotification.isPermissionGranted();
              if (tauriNotificationPermission) {
                sendTauriNotification(tauriNotification, data);
              } else {
                tauri
                  .requestPermission()
                  .then(sendTauriNotification(tauriNotification, data));
              }
            }
          }
        }
      );
    });
  },
};
