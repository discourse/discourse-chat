import { withPluginApi } from "discourse/lib/plugin-api";
import {
  alertChannel,
  init as initDesktopNotifications,
  onNotification,
} from "discourse/lib/desktop-notifications";

let inChat = false;
let previouslyInChat = false;
let chatPresenceChannel;
let corePresenceChannel;

let subscribedToChatNotifications = false;
let subscribedToCoreNotifications = true;

let currentUser, messageBus, siteSettings, appEvents;

export default {
  name: "chat-desktop-notification-manager",
  initialize(container) {
    return;
    currentUser = container.lookup("current-user:main");
    if (!currentUser?.has_chat_enabled) {
      return;
    }

    const presence = container.lookup("service:presence");
    messageBus = container.lookup("message-bus:main");
    siteSettings = container.lookup("site-settings:main");
    appEvents = container.lookup("service:app-events");

    corePresenceChannel = presence.getChannel(
      `/user/${currentUser.id}/non-chat`
    );
    corePresenceChannel.subscribe();
    chatPresenceChannel = presence.getChannel(`/user/${currentUser.id}/chat`);
    chatPresenceChannel.subscribe();

    withPluginApi("0.12.1", (api) => {
      api.onPageChange(pathChanged);
    });
  },
};

function pathChanged(path) {
  inChat = path.startsWith("/chat/channel/");
  if (inChat) {
    chatPresenceChannel.enter();
    corePresenceChannel.leave();
  } else {
    chatPresenceChannel.leave();
    corePresenceChannel.enter();
  }
  subscribeToCorrectNotifications();
  previouslyInChat = inChat;
}

function subscribeToCorrectNotifications() {
  const inBoth = chatPresenceChannel.count() && corePresenseChannel.count();
}

function subscribeToChatNotifications() {
  if (!inChat && previouslyInChat) {
    messageBus.subscribe(alertChannel(user), (data) =>
      onNotification(data, siteSettings, user)
    );
  }
  if (subscribedToCoreNotifications) {
    return;
  }

  messageBus.subscribe(`/chat${alertChannel(currentUser)}`, (data) =>
    onNotification(data, siteSettings, currentUser)
  );
}

function subscribeToCoreNotifications(container) {
  if (subscribedToChatNotifications) {
    // UNSUBSCRIBE FROM CHAT
  }
  if (subscribedToCoreNotifications) {
    // SUBSCRIBE TO CORE
  }
}
