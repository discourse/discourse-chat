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
});
