import cookie from "discourse/lib/cookie";
import getURL from "discourse-common/lib/get-url";
import I18n from "I18n";
import RawHtml from "discourse/widgets/raw-html";
import { setTransientHeader } from "discourse/lib/ajax";
import { createWidgetFrom } from "discourse/widgets/widget";
import { DefaultNotificationItem } from "discourse/widgets/default-notification-item";
import { h } from "virtual-dom";
import { formatUsername } from "discourse/lib/utilities";
import { iconNode } from "discourse-common/lib/icon-library";

const chatNotificationItem = {
  services: ["chat", "router"],
  text(notificationName, data) {
    const username = formatUsername(data.mentioned_by_username);
    const identifier = this.transformIdentifier(data);
    const i18nKey = identifier
      ? "notifications.popup.chat_mention.other"
      : "notifications.popup.chat_mention.direct";

    return I18n.t(i18nKey, {
      username,
      identifier,
      channel: data.chat_channel_title,
    });
  },

  transformIdentifier(data) {
    if (!data.identifier) {
      return;
    }

    let identifier = data.identifier;
    if (!data.is_group_mention) {
      identifier = identifier.replace("global", "all");
    }

    return `@${identifier}`;
  },

  html(attrs) {
    const notificationType = attrs.notification_type;
    const lookup = this.site.get("notificationLookup");
    const notificationName = lookup[notificationType];
    const { data } = attrs;
    const title = this.notificationTitle(notificationName, data);
    const text = this.text(notificationName, data);
    const html = new RawHtml({ html: `<div>${text}</div>` });
    const contents = [iconNode("comment"), html];

    return h("a", { attributes: { title } }, contents);
  },

  click() {
    this.attrs.set("read", true);
    const id = this.attrs.id;
    setTransientHeader("Discourse-Clear-Notifications", id);
    cookie("cn", id, { path: getURL("/") });
    this.sendWidgetEvent("linkClicked");
    this.chat.openChannelAtMessage(
      this.attrs.data.chat_channel_id,
      this.attrs.data.chat_message_id
    );
  },
};

createWidgetFrom(
  DefaultNotificationItem,
  "chat-mention-notification-item",
  chatNotificationItem
);
createWidgetFrom(
  DefaultNotificationItem,
  "chat-group-mention-notification-item",
  chatNotificationItem
);
