import { withPluginApi } from "discourse/lib/plugin-api";
import { bind } from "discourse-common/utils/decorators";

export default {
  name: "chat-setup",
  initialize(container) {
    const currentUser = container.lookup("current-user:main");
    const chatService = container.lookup("service:chat");

    if (!chatService.userCanChat) {
      return;
    }

    this.chat = container.lookup("service:chat");

    document.body.classList.add("chat-enabled");

    withPluginApi("0.12.1", (api) => {
      const site = api.container.lookup("site:main");
      if (site.mobileView) {
        currentUser.chat_isolated = false;
      }

      this.chat.getChannels();

      const chatNotificationManager = container.lookup(
        "service:chat-notification-manager"
      );
      chatNotificationManager.start();

      if (!this._registeredDocumentTitleCountCallback) {
        api.addDocumentTitleCounter(this.documentTitleCountCallback);
        this._registeredDocumentTitleCountCallback = true;
      }

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

  @bind
  documentTitleCountCallback() {
    return this.chat.getDocumentTitleCount();
  },
};
