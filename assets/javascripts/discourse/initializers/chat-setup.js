import { withPluginApi } from "discourse/lib/plugin-api";
import I18n from "I18n";
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
      if (api.container.lookup("site:main").mobileView) {
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

      api.decorateCookedElement(
        (elem) => {
          const currentUserTimezone =
            currentUser?.resolvedTimezone(currentUser);
          const chatTranscriptElements = elem.querySelectorAll(
            ".discourse-chat-transcript"
          );
          chatTranscriptElements.forEach((el) => {
            const dateTimeRaw = el.dataset["datetime"];
            const dateTimeLinkEl = el.querySelector(
              ".chat-transcript-datetime a"
            );

            if (currentUserTimezone) {
              dateTimeLinkEl.innerText = moment
                .tz(dateTimeRaw, currentUserTimezone)
                .format(I18n.t("dates.long_no_year"));
            } else {
              dateTimeLinkEl.innerText = moment(dateTimeRaw).format(
                I18n.t("dates.long_no_year")
              );
            }
          });
        },
        { id: "chat-transcript-datetime" }
      );
    });
  },

  @bind
  documentTitleCountCallback() {
    return this.chat.getDocumentTitleCount();
  },
};
