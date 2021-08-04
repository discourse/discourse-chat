import { action, set, setProperties } from "@ember/object";
import { equal, not } from "@ember/object/computed";
import { ajax } from "discourse/lib/ajax";
import Component from "@ember/component";
import discourseComputed, { observes } from "discourse-common/utils/decorators";
import { cancel, throttle } from "@ember/runloop";
import loadScript from "discourse/lib/load-script";
import { inject as service } from "@ember/service";
import { Promise } from "rsvp";

export const LIST_VIEW = "list_view";
export const CHAT_VIEW = "chat_view";

export default Component.extend({
  chatView: equal("view", CHAT_VIEW),
  classNameBindings: [":topic-chat-float-container", "hidden"],
  chatService: service("chat"),

  hidden: true,
  expanded: true, // TODO - false when not first-load topic
  showClose: true, // TODO - false when on same topic
  expectPageChange: false,
  sizeTimer: null,
  rafTimer: null,
  view: null,
  markdownItLoaded: false,
  hasUnreadMessages: false,
  activeChannel: null,
  channels: null,

  didInsertElement() {
    this._super(...arguments);
    if (!this.currentUser || !this.currentUser.can_chat) {
      return;
    }

    this._subscribeToUpdateChannels();
    this._setHasUnreadMessages();
    this.appEvents.on("chat:toggle-open", this, "toggleChat");
    this.appEvents.on("chat:open-channel", this, "openChannelFor");
    this.appEvents.on("chat:open-message", this, "openChannelAtMessage");
    this.appEvents.on("topic-chat-enable", this, "chatEnabledForTopic");
    this.appEvents.on("topic-chat-disable", this, "chatDisabledForTopic");
    this.appEvents.on("composer:closed", this, "_checkSize");
    this.appEvents.on("composer:will-close", this, "_setSizeWillClose");
    this.appEvents.on("composer:opened", this, "_checkSize");
    this.appEvents.on("composer:resized", this, "_checkSize");
    this.appEvents.on("composer:div-resizing", this, "_dynamicCheckSize");
    this.appEvents.on(
      "composer:resize-started",
      this,
      "_startDynamicCheckSize"
    );
    this.appEvents.on("composer:resize-ended", this, "_clearDynamicCheckSize");

    this.loadMarkdownIt().then(() => {
      this.set("markdownItLoaded", true);
    });
  },
  willDestroyElement() {
    this._super(...arguments);
    if (!this.currentUser || !this.currentUser.can_chat) {
      return;
    }

    if (this.appEvents) {
      this._unsubscribeFromUpdateChannels();
      this.appEvents.off("chat:toggle-open", this, "toggleChat");
      this.appEvents.off("chat:open-channel", this, "openChannelFor");
      this.appEvents.off("chat:open-message", this, "openChannelAtMessage");
      this.appEvents.off("topic-chat-enable", this, "chatEnabledForTopic");
      this.appEvents.off("topic-chat-disable", this, "chatDisabledForTopic");
      this.appEvents.off("composer:closed", this, "_checkSize");
      this.appEvents.off("composer:will-close", this, "_setSizeWillClose");
      this.appEvents.off("composer:opened", this, "_checkSize");
      this.appEvents.off("composer:resized", this, "_checkSize");
      this.appEvents.off("composer:div-resizing", this, "_dynamicCheckSize");
      this.appEvents.off(
        "composer:resize-started",
        this,
        "_startDynamicCheckSize"
      );
      this.appEvents.off(
        "composer:resize-ended",
        this,
        "_clearDynamicCheckSize"
      );
    }
    if (this.sizeTimer) {
      cancel(this.sizeTimer);
      this.sizeTimer = null;
    }
    if (this.rafTimer) {
      window.cancelAnimationFrame(this.rafTimer);
    }
  },

  @observes("hidden")
  _fireHiddenAppEvents() {
    this.chatService.setChatOpenStatus(!this.hidden);
    this.appEvents.trigger("chat:rerender-header");
  },

  @observes("currentUser.chat_channel_tracking_state")
  _listenForUnreadMessageChanges() {
    this._setHasUnreadMessages();
  },

  _setHasUnreadMessages() {
    const hasUnread = Object.values(
      this.currentUser.chat_channel_tracking_state
    ).some((trackingState) => trackingState.unread_count > 0);

    if (hasUnread !== this.chatService.getHasUnreadMessages()) {
      // Only update service and header if something changed
      this.chatService.setHasUnreadMessages(hasUnread);
      this.appEvents.trigger("chat:rerender-header");
    }
  },

  loadMarkdownIt() {
    return new Promise((resolve) => {
      let markdownItURL = this.session.markdownItURL;
      if (markdownItURL) {
        loadScript(markdownItURL)
          .then(() => resolve())
          .catch((e) => {
            // eslint-disable-next-line no-console
            console.error(e);
          });
      } else {
        resolve();
      }
    });
  },

  openChannelFor(chatable) {
    if (chatable.chat_channel) {
      this.switchChannel(chatable.chat_channel);
    }
  },

  openChannelAtMessage(chat_channel_id, messageId) {
    this.chatService.setMessageId(messageId);
    ajax(`/chat/${chat_channel_id}.json`).then((response) => {
      this.switchChannel(response.chat_channel);
    });
  },

  chatEnabledForTopic(topic) {
    if (
      !this.activeChannel ||
      this.activeChannel.id === topic.chat_channel_id
    ) {
      // Don't do anything if viewing another topic
      this.openChannelFor(topic);
    }
  },

  chatDisabledForTopic(topic) {
    if (
      this.expanded &&
      this.activeChannel &&
      this.activeChannel.id === topic.chat_channel_id
    ) {
      this.close();
    }
  },

  _dynamicCheckSize() {
    if (!this.rafTimer) {
      this.rafTimer = window.requestAnimationFrame(() => {
        this.rafTimer = null;
        this._performCheckSize();
      });
    }
  },

  _startDynamicCheckSize() {
    this.element.classList.add("clear-transitions");
  },

  _clearDynamicCheckSize() {
    this.element.classList.remove("clear-transitions");
    this._checkSize();
  },

  _checkSize() {
    this.sizeTimer = throttle(this, this._performCheckSize, 150);
  },

  _performCheckSize() {
    if (!this.element || this.isDestroying || this.isDestroyed) {
      return;
    }

    const composer = document.getElementById("reply-control");

    this.element.style.setProperty(
      "--composer-height",
      composer.offsetHeight + "px"
    );
  },

  _setSizeWillClose() {
    if (!this.element || this.isDestroying || this.isDestroyed) {
      return;
    }
    // if overridden by themes, will get fixed up in the composer:closed event
    this.element.style.setProperty("--composer-height", "40px");
  },
  _subscribeToUpdateChannels() {
    for (const [channelId, state] of Object.entries(
      this.currentUser.chat_channel_tracking_state
    )) {
      this.messageBus.subscribe(
        `/chat/${channelId}/new_messages`,
        (busData) => {
          if (busData.user_id === this.currentUser.id) {
            this.currentUser.chat_channel_tracking_state[
              channelId
            ].chat_message_id = busData.message_id;
          } else {
            this.currentUser.chat_channel_tracking_state[
              channelId
            ].unread_count = state.unread_count + 1;
          }
          this.currentUser.notifyPropertyChange("chat_channel_tracking_state");
        }
      );
    }
  },

  _unsubscribeFromUpdateChannels() {
    Object.keys(this.currentUser.chat_channel_tracking_state).forEach(
      (channelId) => {
        this.messageBus.unsubscribe(`/chat/${channelId}/new_messages`);
      }
    );
  },

  @discourseComputed("expanded")
  containerClassNames(expanded) {
    if (expanded) {
      return "topic-chat-container expanded";
    } else {
      return "topic-chat-container";
    }
  },

  @discourseComputed("expanded")
  expandIcon(expanded) {
    if (expanded) {
      return "angle-double-down";
    } else {
      return "angle-double-up";
    }
  },

  @discourseComputed("activeChannel", "currentUser.chat_channel_tracking_state")
  unreadCount(activeChannel, trackingState) {
    return trackingState[activeChannel.id].unread_count;
  },

  @action
  toggleExpand() {
    this.set("expanded", !this.expanded);
  },

  @action
  close() {
    this.setProperties({
      hidden: true,
      activeChannel: null,
    });
  },

  @action
  toggleChat() {
    if (this.hidden) {
      this.fetchChannels();
    } else {
      this.set("hidden", true);
    }
  },

  @action
  fetchChannels() {
    ajax("/chat/index.json").then((channels) => {
      this.setProperties({
        channels: channels,
        activeChannel: null,
        hidden: false,
        expanded: true,
        view: LIST_VIEW,
      });
    });
  },

  @action
  switchChannel(channel) {
    let channelInfo = {
      activeChannel: channel,
      expanded: this.expectPageChange ? true : this.expanded,
      hidden: false,
      expectPageChange: false,
      view: CHAT_VIEW,
    };
    this.setProperties(channelInfo);
  },

  @action
  readLastMessageForChannel(channelId, messageId) {
    const trackingState = this.currentUser.chat_channel_tracking_state[
      channelId
    ];
    setProperties(trackingState, {
      chat_message_id: messageId,
      unread_count: 0,
    });
    this.currentUser.notifyPropertyChange("chat_channel_tracking_state");
  },
});
