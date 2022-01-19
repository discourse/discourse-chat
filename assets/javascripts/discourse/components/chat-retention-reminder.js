import Component from "@ember/component";
import discourseComputed from "discourse-common/utils/decorators";
import { action } from "@ember/object";

export default Component.extend({
  tagName: "",

  @discourseComputed("chatChannel.chatable_type")
  show(chatableType) {
    return (
      (chatableType === "DirectMessageChannel" &&
        this.currentUser.needs_dm_retention_reminder) ||
      this.currentUser.needs_channel_retention_reminder
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

  }
});
