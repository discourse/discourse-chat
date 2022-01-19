import Component from "@ember/component";
import discourseComputed from "discourse-common/utils/decorators";
import { action } from "@ember/object";
import { ajax } from "discourse/lib/ajax";

export default Component.extend({
  tagName: "",
  loading: false,

  @discourseComputed(
    "chatChannel.chatable_type",
    "currentUser.{needs_dm_retention_reminder,needs_channel_retention_reminder}"
  )
  show(chatableType) {
    return (
      (chatableType === "DirectMessageChannel" &&
        this.currentUser.needs_dm_retention_reminder) ||
      (chatableType !== "DirectMessageChannel" &&
        this.currentUser.needs_channel_retention_reminder)
    );
  },

  @discourseComputed("chatChannel.chatable_type")
  daysCount(chatableType) {
    return chatableType === "DirectMessageChannel"
      ? this.siteSettings.chat_channel_retention_days
      : this.siteSettings.chat_dm_retention_days;
  },

  @action
  dismiss() {
    return ajax("/chat/dismiss-retention-reminder", {
      method: "POST",
      data: { chatable_type: this.chatChannel.chatable_type },
    }).then(() => {
      const field =
        this.chatChannel.chatable_type === "DirectMessageChannel"
          ? "needs_dm_retention_reminder"
          : "needs_channel_retention_reminder";
      this.currentUser.set(field, false);
    });
  },
});
