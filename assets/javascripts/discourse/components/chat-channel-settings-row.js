import Component from "@ember/component";
import discourseComputed from "discourse-common/utils/decorators";
import I18n from "I18n";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";
import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";

const NOTIFICATION_LEVELS = [
  { name: I18n.t("chat.notification_levels.never"), value: "never" },
  { name: I18n.t("chat.notification_levels.mention"), value: "mention" },
  { name: I18n.t("chat.notification_levels.always"), value: "always" },
];

const MUTED_OPTIONS = [
  { name: I18n.t("chat.settings.muted_on"), value: true },
  { name: I18n.t("chat.settings.muted_off"), value: false },
];

export default Component.extend({
  channel: null,
  loading: false,
  showSaveSuccess: false,
  notificationLevels: NOTIFICATION_LEVELS,
  mutedOptions: MUTED_OPTIONS,
  chat: service(),
  router: service(),

  didInsertElement() {
    this._super(...arguments);
  },

  @discourseComputed("channel.chatable_type")
  chatChannelClass(channelType) {
    return `${channelType.toLowerCase()}-chat-channel`;
  },

  @action
  follow() {
    this.set("loading", true);
    return ajax(`/chat/chat_channels/${this.channel.id}/follow`, {
      method: "POST",
    })
      .then((membership) => {
        this.channel.setProperties({
          following: true,
          muted: membership.muted,
          desktop_notification_level: membership.desktop_notification_level,
          mobile_notification_level: membership.mobile_notification_level,
        });
        this.chat.startTrackingChannel(this.channel);
        this.set("loading", false);
      })
      .catch(popupAjaxError);
  },

  @action
  unfollow() {
    this.set("loading", true);
    return ajax(`/chat/chat_channels/${this.channel.id}/unfollow`, {
      method: "POST",
    })
      .then(() => {
        this.channel.setProperties({
          expanded: false,
          following: false,
        });
        this.chat.stopTrackingChannel(this.channel);
        this.set("loading", false);
      })
      .catch(popupAjaxError);
  },

  @action
  previewChannel() {
    this.chat.openChannel(this.channel);
  },
});
