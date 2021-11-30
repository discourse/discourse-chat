import Service, { inject as service } from "@ember/service";
import discourseDebounce from "discourse-common/lib/debounce";
import { withPluginApi } from "discourse/lib/plugin-api";
import { isTesting } from "discourse-common/config/environment";
import {
  alertChannel,
  onNotification,
} from "discourse/lib/desktop-notifications";
import { observes } from "discourse-common/utils/decorators";

export default Service.extend({
  presence: service(),
  chat: service(),
  _inChat: false,
  _subscribedToCore: true,
  _subscribedToChat: false,
  _countChatInDocTitle: true,

  start() {
    if (!this._shouldRun()) {
      return;
    }

    this.set(
      "_chatPresenceChannel",
      this.presence.getChannel(`/chat-user/chat/${this.currentUser.id}`)
    );
    this.set(
      "_corePresenceChannel",
      this.presence.getChannel(`/chat-user/core/${this.currentUser.id}`)
    );
    this._chatPresenceChannel.subscribe();
    this._corePresenceChannel.subscribe();
    const boundOnPageChange = this._pageChanged.bind(this);

    withPluginApi("0.12.1", (api) => {
      api.onPageChange(boundOnPageChange);
    });
  },

  willDestroy() {
    this._super(...arguments);
    if (!this._shouldRun()) {
      return;
    }

    this._chatPresenceChannel.unsubscribe();
    this._chatPresenceChannel.leave();
    this._corePresenceChannel.unsubscribe();
    this._corePresenceChannel.leave();
  },

  shouldCountChatInDocTitle() {
    if (this.currentUser.chat_isolated && !this.chat.onChatPage()) {
      return false;
    }

    return this._countChatInDocTitle;
  },

  _pageChanged(path) {
    this.set("_inChat", path.startsWith("/chat/channel/"));
    if (this._inChat) {
      this._chatPresenceChannel.enter({ onlyWhileActive: false });
      this._corePresenceChannel.leave();
    } else {
      this._chatPresenceChannel.leave();
      this._corePresenceChannel.enter({ onlyWhileActive: false });
    }
  },

  @observes("_chatPresenceChannel.count", "_corePresenceChannel.count")
  _channelCountsChanged() {
    discourseDebounce(this, this._subscribeToCorrectNotifications, 2000);
  },

  _coreAlertChannel() {
    return alertChannel(this.currentUser);
  },

  _chatAlertChannel() {
    return `/chat${alertChannel(this.currentUser)}`;
  },

  _subscribeToCorrectNotifications() {
    const oneTabForEachOpen =
      this._chatPresenceChannel.count > 0 &&
      this._corePresenceChannel.count > 0;
    if (oneTabForEachOpen) {
      this._inChat
        ? this._subscribeToChat({ only: true })
        : this._subscribeToCore({ only: true });
    } else {
      this._subscribeToBoth();
    }
  },

  _subscribeToBoth() {
    this._subscribeToChat();
    this._subscribeToCore();
  },

  _subscribeToChat(opts = { only: false }) {
    this.set("_countChatInDocTitle", true);

    if (this.currentUser.chat_isolated && !this.chat.onChatPage()) {
      return;
    }

    if (!this._subscribedToChat) {
      this.messageBus.subscribe(this._chatAlertChannel(), (data) =>
        onNotification(data, this.siteSettings, this.currentUser)
      );
    }

    if (opts.only && this._subscribedToCore) {
      this.messageBus.unsubscribe(this._coreAlertChannel());
      this.set("_subscribedToCore", false);
    }
  },

  _subscribeToCore(opts = { only: false }) {
    if (opts.only) {
      this.set("_countChatInDocTitle", false);
    }
    if (!this._subscribedToCore) {
      this.messageBus.subscribe(this._coreAlertChannel(), (data) =>
        onNotification(data, this.siteSettings, this.currentUser)
      );
    }

    if (this.only && this._subscribedToChat) {
      this.messageBus.unsubscribe(this._chatAlertChannel());
      this.set("_subscribedToChat", false);
    }
  },

  _shouldRun() {
    return this.currentUser?.has_chat_enabled && !isTesting();
  },
});
