import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "chat-user-menu",
  initialize(container) {
    withPluginApi("1.3.0", (api) => {
      const chatService = container.lookup("service:chat");

      if (!chatService.userCanChat) {
        return;
      }

      if (api.registerUserMenuComponentForNotificationType) {
        api.registerUserMenuComponentForNotificationType(
          "chat_mention",
          "user-menu/chat-mention-notification-item"
        );

        api.registerUserMenuComponentForNotificationType(
          "chat_group_mention",
          "user-menu/chat-group-mention-notification-item"
        );

        api.registerUserMenuComponentForNotificationType(
          "chat_invitation",
          "user-menu/chat-invitation-notification-item"
        );
      }

      if (api.registerUserMenuTab) {
        api.registerUserMenuTab((UserMenuTab) => {
          return class extends UserMenuTab {
            get id() {
              return "chat-notifications";
            }

            get panelComponent() {
              return "user-menu/chat-notifications-list";
            }

            get icon() {
              return "comment";
            }

            get count() {
              return (
                this.getUnreadCountForType("chat_mention") +
                this.getUnreadCountForType("chat_invitation")
              );
            }
          };
        });
      }
    });
  },
};
