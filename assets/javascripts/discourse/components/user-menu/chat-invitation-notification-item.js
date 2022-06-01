import UserMenuNotificationItem from "discourse/components/user-menu/notification-item";
import { inject as service } from "@ember/service";
import { action } from "@ember/object";
import { formatUsername } from "discourse/lib/utilities";
import I18n from "I18n";

export default class UserMenuChatInvitationNotificationItem extends UserMenuNotificationItem {
  @service chat;

  // TODO: rely on URLs for navigation instead of click JS events
  // in the onClick action below. See internal ticket 67611.
  get url() {
    return null;
  }

  get icon() {
    return "link";
  }

  get label() {
    return formatUsername(this.notification.data.invited_by_username);
  }

  get description() {
    return I18n.t("notifications.chat_invitation");
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
