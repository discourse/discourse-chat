import Component from "@ember/component";
import I18n from "I18n";
import { action } from "@ember/object";
import { ajax } from "discourse/lib/ajax";
import { later } from "@ember/runloop";
import { inject as service } from "@ember/service";

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
  router: service(),

  @action
  follow() {
    this.set("loading", true);
    return ajax(`/chat/chat_channels/${this.channel.id}/follow`, {
      method: "POST",
    }).then((membership) => {
      this.channel.setProperties({
        following: true,
        muted: membership.muted,
        desktop_notification_level: membership.desktop_notification_level,
        mobile_notification_level: membership.mobile_notification_level,
      });
      this.set("loading", false);
    });
  },

  @action
  unfollow() {
    this.set("loading", true);
    return ajax(`/chat/chat_channels/${this.channel.id}/unfollow`, {
      method: "POST",
    }).then((response) => {
      this.channel.setProperties({
        expanded: false,
        following: false,
      });
      this.set("loading", false);
    });
  },

  @action
  toggleExpanded() {
    this.channel.set("expanded", !this.channel.expanded);
    const expandBtn = this.element.querySelector(".chat-channel-expand-settings")
    if (expandBtn) {
      expandBtn.blur(); // Button isn't lossing focus naturally.
    }
    return false;
  },

  @action
  save() {
    this.set("loading", true);
    return ajax(`/chat/chat_channels/${this.channel.id}/notification_settings`, {
      method: "POST",
      data: {
        muted: this.channel.muted,
        desktop_notification_level: this.channel.desktop_notification_level,
        mobile_notification_level: this.channel.mobile_notification_level,
      }
    }).then((response) => {
      this.setProperties({
        loading: false,
        showSaveSuccess: true
      })
      later(() => {
        if (!this.isDestroying && !this.isDestroyed) {
          this.set("showSaveSuccess", false);
        }
      }, 2000)
    });
  },

  @action
  previewChannel() {
    this.router.transitionTo("chat.channel", { queryParams: { previewing: true }})
  }
});
