import { withPluginApi } from "discourse/lib/plugin-api";

export const CHAT_SOUNDS = {
  bell: "/plugins/discourse-chat/audio/bell.mp3",
  ding: "/plugins/discourse-chat/audio/ding.mp3",
};

const MENTION = 29;
const MESSAGE = 30;
const CHAT_NOTIFICATION_TYPES = [MENTION, MESSAGE];

const AUDIO_DEBOUNCE_TIMEOUT = 3000;

export default {
  name: "chat-notification-sounds",
  initialize(container) {
    const currentUser = container.lookup("current-user:main");
    if (!currentUser?.has_chat_enabled || !currentUser?.chat_sound) {
      return;
    }

    let canPlay = true;

    function playAudio(user) {
      try {
        new Audio(CHAT_SOUNDS[user.chat_sound]).play();
      } catch (error) {
        if (error instanceof DOMException) {
          // eslint-disable-next-line no-console
          console.info(
            "User needs to interact with DOM before we can play notification sounds"
          );
        } else {
          throw error;
        }
      }
    }

    function playAudioWithDebounce(user) {
      if (canPlay) {
        canPlay = false;

        setTimeout(() => {
          canPlay = true;
          playAudio(user);
        }, AUDIO_DEBOUNCE_TIMEOUT);
      }
    }

    withPluginApi("0.12.1", (api) => {
      api.registerDesktopNotificationHandler((data, siteSettings, user) => {
        if (CHAT_NOTIFICATION_TYPES.includes(data.notification_type)) {
          playAudioWithDebounce(user);
        }
      });
    });
  },
};
