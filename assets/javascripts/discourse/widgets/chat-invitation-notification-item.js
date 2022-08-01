import I18n from "I18n";
import RawHtml from "discourse/widgets/raw-html";
import { createWidgetFrom } from "discourse/widgets/widget";
import { DefaultNotificationItem } from "discourse/widgets/default-notification-item";
import { h } from "virtual-dom";
import { formatUsername } from "discourse/lib/utilities";
import { iconNode } from "discourse-common/lib/icon-library";

createWidgetFrom(DefaultNotificationItem, "chat-invitation-notification-item", {
  services: ["chat", "router"],
  text(data) {
    const username = formatUsername(data.invited_by_username);
    return I18n.t(data.message, { username });
  },

  html(attrs) {
    const notificationType = attrs.notification_type;
    const lookup = this.site.get("notificationLookup");
    const notificationName = lookup[notificationType];
    const { data } = attrs;
    const text = this.text(data);
    const title = this.notificationTitle(notificationName, data);
    const html = new RawHtml({ html: `<div>${text}</div>` });
    const contents = [iconNode("link"), html];
    const href = this.url(data);

    return h(
      "a",
      { attributes: { title, href, "data-auto-route": true } },
      contents
    );
  },

  url(data) {
    return `/chat/channel/${data.chat_channel_id}/chat?messageId=${data.chat_message_id}`;
  },
});
