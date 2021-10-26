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
  inChat: false,

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

  _pageChanged(path) {
    this.set("inChat", path.startsWith("/chat/channel/"));
    if (this.inChat) {
      this._chatPresenceChannel.enter();
      this._corePresenceChannel.leave();
    } else {
      this._chatPresenceChannel.leave();
      this._corePresenceChannel.enter();
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
    this._unsubscribeFromBoth();

    const oneTabForEachOpen =
      this._chatPresenceChannel.count > 0 &&
      this._corePresenceChannel.count > 0;
    if (oneTabForEachOpen) {
      this.inChat ? this._subscribeToChat() : this._subscribeToCore();
    } else {
      this._subscribeToBoth();
    }
  },

  _unsubscribeFromBoth() {
    this.messageBus.unsubscribe(this._coreAlertChannel());
    this.messageBus.unsubscribe(this._chatAlertChannel());
  },

  _subscribeToBoth() {
    this._subscribeToChat();
    this._subscribeToCore();
  },

  _subscribeToChat() {
    this.messageBus.subscribe(this._chatAlertChannel(), (data) =>
      onNotification(data, this.siteSettings, this.currentUser)
    );
  },

  _subscribeToCore() {
    this.messageBus.subscribe(this._coreAlertChannel(), (data) =>
      onNotification(data, this.siteSettings, this.currentUser)
    );
  },

  _shouldRun() {
    return this.currentUser?.has_chat_enabled && !isTesting();
  },
});
