import bootbox from "bootbox";
import Component from "@ember/component";
import { action, computed } from "@ember/object";
import { inject as service } from "@ember/service";
import ChatApi from "discourse/plugins/discourse-chat/discourse/lib/chat-api";
import showModal from "discourse/lib/show-modal";
import I18n from "I18n";
import { camelize } from "@ember/string";
import { later } from "@ember/runloop";
import { isTesting } from "discourse-common/config/environment";

const NOTIFICATION_LEVELS = [
  { name: I18n.t("chat.notification_levels.never"), value: "never" },
  { name: I18n.t("chat.notification_levels.mention"), value: "mention" },
  { name: I18n.t("chat.notification_levels.always"), value: "always" },
];

const MUTED_OPTIONS = [
  { name: I18n.t("chat.settings.muted_on"), value: true },
  { name: I18n.t("chat.settings.muted_off"), value: false },
];

export default class ChatChannelSettingsView extends Component {
  tagName = "";
  channel = null;
  @service chat;
  @service router;
  notificationLevels = NOTIFICATION_LEVELS;
  mutedOptions = MUTED_OPTIONS;
  isSavingNotificationSetting = false;
  savedDesktopNotificationLevel = false;
  savedMobileNotificationLevel = false;
  savedMuted = false;

  _updateAutoJoinUsers(value) {
    return ChatApi.modifyChatChannel(this.channel.id, {
      auto_join_users: value,
    })
      .then((chatChannel) => {
        this.channel.set("auto_join_users", chatChannel.auto_join_users);
      })
      .catch((event) => {
        if (event.jqXHR?.responseJSON?.errors) {
          this.flash(event.jqXHR.responseJSON.errors.join("\n"), "error");
        }
      });
  }

  @action
  saveNotificationSettings(key, value) {
    if (this.channel[key] === value) {
      return;
    }

    const camelizedKey = camelize(`saved_${key}`);
    this.set(camelizedKey, false);

    const settings = {};
    settings[key] = value;
    return ChatApi.updateChatChannelNotificationsSettings(
      this.channel.id,
      settings
    )
      .then((membership) => {
        this.channel.set("muted", membership.muted);
        this.channel.set(
          "desktop_notification_level",
          membership.desktop_notification_level
        );
        this.channel.set(
          "mobile_notification_level",
          membership.mobile_notification_level
        );
        this.set(camelizedKey, true);
      })
      .finally(() => {
        later(
          () => {
            if (this.isDestroying || this.isDestroyed) {
              return;
            }

            this.set(camelizedKey, false);
          },
          isTesting() ? 0 : 2000
        );
      });
  }

  @computed(
    "siteSettings.chat_allow_archiving_channels",
    "channel.{isArchived,isReadOnly}"
  )
  get canArchiveChannel() {
    return (
      this.siteSettings.chat_allow_archiving_channels &&
      !this.channel.isArchived &&
      !this.channel.isReadOnly
    );
  }

  @computed(
    "siteSettings.max_chat_auto_joined_users",
    "channel.isCategoryChannel"
  )
  get autoJoinAvailable() {
    return (
      this.siteSettings.max_chat_auto_joined_users > 0 &&
      this.channel.isCategoryChannel
    );
  }

  @action
  onArchiveChannel() {
    const controller = showModal("chat-channel-archive-modal");
    controller.set("chatChannel", this.channel);
  }

  @action
  onDeleteChannel() {
    const controller = showModal("chat-channel-delete-modal");
    controller.set("chatChannel", this.channel);
  }

  @action
  onToggleChannelState() {
    const controller = showModal("chat-channel-toggle");
    controller.set("chatChannel", this.channel);
  }

  @action
  onDisableAutoJoinUsers() {
    this._updateAutoJoinUsers(false);
  }

  @action
  onEnableAutoJoinUsers() {
    bootbox.confirm(
      I18n.t("chat.settings.auto_join_users_warning", {
        category: this.channel.chatable.name,
      }),
      (confirmed) => {
        if (confirmed) {
          this._updateAutoJoinUsers(true);
        }
      }
    );
  }
}
