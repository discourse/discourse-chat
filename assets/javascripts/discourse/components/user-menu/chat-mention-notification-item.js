import UserMenuNotificationItem from "discourse/components/user-menu/notification-item";
import { inject as service } from "@ember/service";
import { action } from "@ember/object";
import { formatUsername, postUrl } from "discourse/lib/utilities";
import { userPath } from "discourse/lib/url";
import I18n from "I18n";

export default class UserMenuChatMentionNotificationItem extends UserMenuNotificationItem {
  @service chat;

  // TODO: rely on URLs for navigation instead of click JS events
  // in the onClick action below. See internal ticket 67611.
  get url() {
    return null;
  }

  get icon() {
    return "comment";
  }

  get label() {
    return formatUsername(this.notification.data.mentioned_by_username);
  }

  get description() {
    const identifier = this.notification.data.identifier
      ? `@${this.notification.data.identifier}`
      : null;

    const i18nPrefix = this.notification.data.is_direct_message_channel
      ? "notifications.popup.direct_message_chat_mention"
      : "notifications.popup.chat_mention";

    const i18nSuffix = identifier ? "other" : "direct";

    return I18n.t(`${i18nPrefix}.${i18nSuffix}`, {
      identifier,
      channel: this.notification.data.chat_channel_title,
    });
  }

  get descriptionHtmlSafe() {
    return false;
  }

  @action
  onClick() {
    super.onClick(...arguments);
    this.chat.openChannelAtMessage(
      this.notification.data.chat_channel_id,
      this.notification.data.chat_message_id
    );
  }
}
