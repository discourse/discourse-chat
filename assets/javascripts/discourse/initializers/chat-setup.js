import { h } from "virtual-dom";
import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "chat-setup",
  initialize(container) {
    const currentUser = container.lookup("current-user:main");
    if (!currentUser) {
      return;
    }

    withPluginApi("0.12.1", (api) => {
      if (currentUser.can_chat) {
        api.decorateWidget("menu-links:before", (helper) => {
          if (helper.attrs.name === "footer-links") {
            return [helper.widget.attach("hamburger-chat-toggle"), h("hr")];
          }
        });
      }

      if (currentUser.has_chat_enabled) {
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
      }
    });
  },
};
