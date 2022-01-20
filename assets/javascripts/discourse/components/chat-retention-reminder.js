import Component from "@ember/component";
import discourseComputed from "discourse-common/utils/decorators";
import I18n from "I18n";
import { action } from "@ember/object";
import { ajax } from "discourse/lib/ajax";
import { CHATABLE_TYPES } from "discourse/plugins/discourse-chat/discourse/models/chat-channel";
import { popupAjaxError } from "discourse/lib/ajax-error";

export default Component.extend({
  tagName: "",
  loading: false,

  @discourseComputed(
    "chatChannel.chatable_type",
    "currentUser.{needs_dm_retention_reminder,needs_channel_retention_reminder}"
  )
  show(chatableType) {
    return (
      (chatableType === CHATABLE_TYPES.directMessageChannel &&
        this.currentUser.needs_dm_retention_reminder) ||
      (chatableType !== CHATABLE_TYPES.directMessageChannel &&
        this.currentUser.needs_channel_retention_reminder)
    );
  },

  @discourseComputed("chatChannel.chatable_type")
  text(chatableType) {
    let days = this.siteSettings.chat_channel_retention_days;
    let translationKey = "chat.retention_reminders.public";

    if (chatableType === CHATABLE_TYPES.directMessageChannel) {
      days = this.siteSettings.chat_dm_retention_days;
      translationKey = "chat.retention_reminders.dm";
    }
    return I18n.t(translationKey, { days });
  },

  @discourseComputed("chatChannel.chatable_type")
  daysCount(chatableType) {
    return chatableType === CHATABLE_TYPES.directMessageChannel
      ? this.siteSettings.chat_dm_retention_days
      : this.siteSettings.chat_channel_retention_days;
  },

  @action
  dismiss() {
    return ajax("/chat/dismiss-retention-reminder", {
      method: "POST",
      data: { chatable_type: this.chatChannel.chatable_type },
    })
      .then(() => {
        const field =
          this.chatChannel.chatable_type === CHATABLE_TYPES.directMessageChannel
            ? "needs_dm_retention_reminder"
            : "needs_channel_retention_reminder";
        this.currentUser.set(field, false);
      })
      .catch(popupAjaxError);
  },
});
