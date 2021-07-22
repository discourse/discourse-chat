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

createWidgetFrom(DefaultNotificationItem, "chat-mention-notification-item", {
  text(notificationName, data) {
    const username = formatUsername(data.mentioned_by_username);
    return I18n.t(data.message, { username });
  },

  html(attrs) {
    const notificationType = attrs.notification_type;
    const lookup = this.site.get("notificationLookup");
    const notificationName = lookup[notificationType];

    let { data } = attrs;
    let text = this.text(notificationName, data);
    const title = this.notificationTitle(notificationName, data);
    let html = new RawHtml({ html: `<div>${text}</div>` });

    let contents = [iconNode("at"), html];

    return h("a", { attributes: { title } }, contents);
  },

  click(e) {
    this.attrs.set("read", true);
    const id = this.attrs.id;
    setTransientHeader("Discourse-Clear-Notifications", id);
    cookie("cn", id, { path: getURL("/") });

    e.preventDefault();

    this.sendWidgetEvent("linkClicked");
    this.appEvents.trigger(
      "chat:open-message",
      this.attrs.data.chat_channel_id,
      this.attrs.data.chat_message_id
    );
  },
});
