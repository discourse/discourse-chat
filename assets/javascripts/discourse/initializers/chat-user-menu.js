import I18n from "I18n";

import { withPluginApi } from "discourse/lib/plugin-api";
import { formatUsername } from "discourse/lib/utilities";
import slugifyChannel from "discourse/plugins/discourse-chat/discourse/lib/slugify-channel";

export default {
  name: "chat-user-menu",
  initialize(container) {
    withPluginApi("1.3.0", (api) => {
      const chat = container.lookup("service:chat");

      if (!chat.userCanChat) {
        return;
      }

      if (api.registerNotificationTypeRenderer) {
        api.registerNotificationTypeRenderer(
          "chat_invitation",
          (NotificationItemBase) => {
            return class extends NotificationItemBase {
              get linkHref() {
                const title = this.notification.data.chat_channel_title
                  ? slugifyChannel(this.notification.data.chat_channel_title)
                  : "-";

                return `/chat/channel/${this.notification.data.chat_channel_id}/${title}?messageId=${this.notification.data.chat_message_id}`;
              }

              get linkTitle() {
                return I18n.t("notifications.titles.chat_invitation");
              }

              get icon() {
                return "link";
              }

              get label() {
                return formatUsername(
                  this.notification.data.invited_by_username
                );
              }

              get description() {
                return I18n.t("notifications.chat_invitation");
              }
            };
          }
        );

        ["chat_mention", "chat_group_mention"].forEach((notificationType) => {
          api.registerNotificationTypeRenderer(
            notificationType,
            (NotificationItemBase) => {
              return class extends NotificationItemBase {
                get linkHref() {
                  const title = this.notification.data.chat_channel_title
                    ? slugifyChannel(this.notification.data.chat_channel_title)
                    : "-";

                  return `/chat/channel/${this.notification.data.chat_channel_id}/${title}?messageId=${this.notification.data.chat_message_id}`;
                }

                get linkTitle() {
                  return I18n.t("notifications.titles.chat_mention");
                }

                get icon() {
                  return "comment";
                }

                get label() {
                  return formatUsername(
                    this.notification.data.mentioned_by_username
                  );
                }

                get description() {
                  const identifier = this.notification.data.identifier
                    ? `@${this.notification.data.identifier}`
                    : null;

                  const i18nPrefix = this.notification.data
                    .is_direct_message_channel
                    ? "notifications.popup.direct_message_chat_mention"
                    : "notifications.popup.chat_mention";

                  const i18nSuffix = identifier ? "other" : "direct";

                  return I18n.t(`${i18nPrefix}.${i18nSuffix}`, {
                    identifier,
                    channel: this.notification.data.chat_channel_title,
                  });
                }
              };
            }
          );
        });
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
