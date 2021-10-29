import EmberObject from "@ember/object";
import Service, { inject as service } from "@ember/service";
import Site from "discourse/models/site";
import { addChatToolbarButton } from "discourse/plugins/discourse-topic-chat/discourse/components/chat-composer";
import { ajax } from "discourse/lib/ajax";
import { A } from "@ember/array";
import { defaultHomepage } from "discourse/lib/utilities";
import { generateCookFunction } from "discourse/lib/text";
import { Promise } from "rsvp";
import simpleCategoryHashMentionTransform from "discourse/plugins/discourse-topic-chat/discourse/lib/simple-category-hash-mention-transform";

export const LIST_VIEW = "list_view";
export const CHAT_VIEW = "chat_view";

export default Service.extend({
  allChannels: null,
  appEvents: service(),
  chatOpen: false,
  chatNotificationManager: service(),
  cook: null,
  directMessageChannels: null,
  hasFetchedChannels: false,
  hasUnreadPublicMessages: false,
  idToTitleMap: null,
  lastNonChatRoute: null,
  lastUserTrackingMessageId: null,
  messageId: null,
  presence: service(),
  presenceChannel: null,
  publicChannels: null,
  router: service(),
  sidebarActive: false,
  unreadUrgentCount: null,
  _fetchingChannels: null,

  init() {
    this._super(...arguments);

    if (this.currentUser?.has_chat_enabled) {
      this.set("allChannels", []);
      this._subscribeToNewDmChannelUpdates();
      this._subscribeToUserTrackingChannel();
      this.presenceChannel = this.presence.getChannel("/chat/online");
      this.appEvents.on("page:changed", this, "_storeLastNonChatRouteInfo");
      this.appEvents.on("modal:closed", this, "_onSettingsModalClosed");
    }
  },

  willDestroy() {
    this._super(...arguments);
    if (this.currentUser?.has_chat_enabled) {
      this.set("allChannels", null);
      this._unsubscribeFromNewDmChannelUpdates();
      this._unsubscribeFromUserTrackingChannel();
      this._unsubscribeFromAllChatChannels();
      this.appEvents.off("page:changed", this, "_storeLastNonChatRouteInfo");
      this.appEvents.off("modal:closed", this, "_onSettingsModalClosed");
    }
  },

  _onSettingsModalClosed(modal) {
    if (modal.name !== "chat-channel-settings") {
      return;
    }

    // Check the route the modal was opened on. If it was opened
    // on full page chat for a channel that is not followed, navigate
    // home.
    if (modal.controller.openedOnRouteName === "chat.channel") {
      const currentChannel = modal.controller.channels.find(
        (c) => c.title === this.router.currentRoute.params.channelTitle
      );
      if (currentChannel && !currentChannel.following) {
        this.router.transitionTo(`discovery.${defaultHomepage()}`);
      }
    }

    this.forceRefreshChannels().then(() => {
      this.appEvents.trigger("chat:refresh-channels");
    });
  },

  _storeLastNonChatRouteInfo(data) {
    if (
      data.currentRouteName !== "chat" &&
      data.currentRouteName !== "chat.channel"
    ) {
      this.set("lastNonChatRoute", data.url);
    }
  },

  getLastNonChatRoute() {
    return this.lastNonChatRoute && this.lastNonChatRoute !== "/"
      ? this.lastNonChatRoute
      : `discovery.${defaultHomepage()}`;
  },

  onChatPage() {
    return (
      this.router.currentRouteName === "chat" ||
      this.router.currentRouteName === "chat.channel"
    );
  },

  getSidebarActive() {
    return this.sidebarActive;
  },

  setSidebarActive(on) {
    this.set("sidebarActive", on);
  },

  loadCookFunction(categories) {
    if (this.cook) {
      return Promise.resolve(this.cook);
    }

    return generateCookFunction(MARKDOWN_OPTIONS).then((cookFunction) => {
      return this.set("cook", (raw) => {
        return simpleCategoryHashMentionTransform(
          cookFunction(raw),
          categories
        );
      });
    });
  },

  setMessageId(messageId) {
    this.set("messageId", messageId);
  },

  getMessageId() {
    return this.messageId;
  },

  clearMessageId() {
    this.set("messageId", null);
  },

  setFullScreenChatOpenStatus(status) {
    this.set("fullScreenChatOpen", status);
    this._updatePresence();
  },

  setChatOpenStatus(status) {
    this.set("chatOpen", status);
    this._updatePresence();
  },
  getChatOpenStatus() {
    return this.chatOpen;
  },

  _updatePresence() {
    if (this.fullScreenChatOpen || this.chatOpen) {
      this.presenceChannel.enter();
    } else {
      this.presenceChannel.leave();
    }
  },

  setHasUnreadMessages(value) {
    this.set("hasUnreadMessages", value);
  },
  getHasUnreadMessages() {
    return this.hasUnreadMessages;
  },

  setUnreadUrgentCount(count) {
    this.set("unreadUrgentCount", count);
  },
  getUnreadUrgentCount() {
    return this.unreadUrgentCount;
  },

  getDocumentTitleCount() {
    return this.chatNotificationManager.shouldCountChatInDocTitle()
      ? this.unreadUrgentCount
      : 0;
  },

  _channelObject() {
    return {
      publicChannels: this.publicChannels,
      directMessageChannels: this.directMessageChannels,
    };
  },

  getChannels() {
    return new Promise((resolve) => {
      if (this.hasFetchedChannels) {
        return resolve(this._channelObject());
      }

      if (!this._fetchingChannels) {
        this._fetchingChannels = this._refreshChannels().finally(
          () => (this._fetchingChannels = null)
        );
      }

      this._fetchingChannels.then(() => resolve(this._channelObject()));
    });
  },

  forceRefreshChannels() {
    this.set("hasFetchedChannels", false);
    this._unsubscribeFromAllChatChannels();
    return this.getChannels();
  },

  _refreshChannels() {
    return new Promise((resolve) => {
      this.set("loading", true);
      this.currentUser.set("chat_channel_tracking_state", {});
      ajax("/chat/chat_channels.json").then((channels) => {
        this.setProperties({
          publicChannels: A(
            channels.public_channels.map((channel) =>
              this.processChannel(channel)
            )
          ),
          directMessageChannels: A(
            channels.direct_message_channels.map((channel) =>
              this.processChannel(channel)
            )
          ),
          hasFetchedChannels: true,
          loading: false,
        });
        const idToTitleMap = {};
        this.allChannels.forEach((c) => {
          idToTitleMap[c.id] = c.title;
        });
        this.set("idToTitleMap", idToTitleMap);
        this.presenceChannel.subscribe(channels.global_presence_channel_state);
        this.userChatChannelTrackingStateChanged();
        resolve(this._channelObject());
      });
    });
  },

  async getChannelBy(key, value) {
    return this.getChannels().then(() => {
      if (!isNaN(value)) {
        value = parseInt(value, 10);
      }
      return this.allChannels.findBy(key, value);
    });
  },

  getIdealFirstChannelId() {
    // When user opens chat we need to give them the 'best' channel when they enter.
    // Look for public channels with mentions. If one exists, enter that.
    // Next best is a DM channel with unread messages.
    // Next best is a public channel with unread messages.
    // If there is no ideal channel ID, return null and handle the fallback in the consumer.
    return this.getChannels().then(() => {
      let publicChannelId;
      let publicChannelIdWithMention;
      let dmChannelIdWithUnread;

      for (const [channelId, state] of Object.entries(
        this.currentUser.chat_channel_tracking_state
      )) {
        if (state.chatable_type === "DirectMessageChannel") {
          if (!dmChannelIdWithUnread && state.unread_count > 0) {
            dmChannelIdWithUnread = channelId;
          }
        } else {
          if (!publicChannelIdWithMention && state.unread_mentions > 0) {
            publicChannelIdWithMention = channelId;
            break; // <- We have a public channel with a mention. Break and return this.
          } else if (!publicChannelId && state.unread_count > 0) {
            publicChannelId = channelId;
          }
        }
      }
      return (
        publicChannelIdWithMention || dmChannelIdWithUnread || publicChannelId
      );
    });
  },

  getIdealFirstChannelTitle() {
    return this.getIdealFirstChannelId().then((channelId) => {
      if (channelId) {
        return this.idToTitleMap[channelId];
      } else {
        return this.publicChannels[0]?.title;
      }
    });
  },

  async openChannelAtMessage(channelId, messageId) {
    let channel = await this.getChannelBy("id", channelId);
    if (channel) {
      return this._openFoundChannelAtMessage(channel, messageId);
    }

    return ajax(`/chat/chat_channels/${channelId}`).then((response) => {
      this.router.transitionTo("chat.channel", response.chat_channel.title, {
        queryParams: { messageId },
      });
    });
  },

  _openFoundChannelAtMessage(channel, messageId) {
    if (
      this.router.currentRouteName === "chat.channel" &&
      this.router.currentRoute.params.channelTitle === channel.title
    ) {
      this._fireOpenMessageAppEvent(channel.id, messageId);
    } else if (
      Site.currentProp("mobileView") ||
      this.router.currentRouteName === "chat" ||
      this.router.currentRouteName === "chat.channel"
    ) {
      this.router.transitionTo("chat.channel", channel.title, {
        queryParams: { messageId: messageId },
      });
    } else {
      this.setMessageId(messageId);
      this._fireOpenMessageAppEvent(channel.id, messageId, { openFloat: true });
    }
  },

  _fireOpenMessageAppEvent(channelId, messageId, opts = { openFloat: false }) {
    this.appEvents.trigger(
      "chat:open-message",
      channelId,
      messageId,
      opts.openFloat
    );
  },

  _subscribeToNewDmChannelUpdates() {
    this.messageBus.subscribe("/chat/new-direct-message-channel", (busData) => {
      this.directMessageChannels.pushObject(
        this.processChannel(busData.chat_channel)
      );
      this.currentUser.chat_channel_tracking_state[busData.chat_channel.id] = {
        unread_count: 0,
        unread_mentions: 0,
        chatable_type: "DirectMessageChannel",
      };
      this.userChatChannelTrackingStateChanged();
    });
  },

  _unsubscribeFromNewDmChannelUpdates() {
    this.messageBus.unsubscribe("/chat/new-direct-message-channel");
  },

  _subscribeToSingleUpdateChannel(channel) {
    if (channel.muted) {
      return;
    }

    if (channel.chatable_type !== "DirectMessageChannel") {
      this._subscribeToMentionChannel(channel);
    }

    this.messageBus.subscribe(`/chat/${channel.id}/new-messages`, (busData) => {
      if (busData.user_id === this.currentUser.id) {
        // User sent message, update tracking state to no unread
        this.currentUser.chat_channel_tracking_state[
          channel.id
        ].chat_message_id = busData.message_id;
      } else {
        // Message from other user. Incriment trackings state
        const trackingState = this.currentUser.chat_channel_tracking_state[
          channel.id
        ];
        if (busData.message_id > (trackingState.chat_message_id || 0)) {
          trackingState.unread_count = trackingState.unread_count + 1;
        }
      }
      this.userChatChannelTrackingStateChanged();

      // Update updated_at timestamp for channel if direct message
      const dmChatChannel = (this.directMessageChannels || []).findBy(
        "id",
        parseInt(channel.id, 10)
      );
      if (dmChatChannel) {
        dmChatChannel.set("updated_at", new Date());
        this.notifyPropertyChange("directMessageChannels");
      }
    });
  },

  _subscribeToMentionChannel(channel) {
    this.messageBus.subscribe(`/chat/${channel.id}/new-mentions`, () => {
      const trackingState = this.currentUser.chat_channel_tracking_state[
        channel.id
      ];
      if (trackingState) {
        trackingState.unread_mentions =
          (trackingState.unread_mentions || 0) + 1;
        this.userChatChannelTrackingStateChanged();
      }
    });
  },

  _unsubscribeFromAllChatChannels() {
    (this.allChannels || []).forEach((channel) => {
      this.messageBus.unsubscribe(`/chat/${channel.id}/new-messages`);
      if (channel.chatable_type !== "DirectMessageChannel") {
        this.messageBus.unsubscribe(`/chat/${channel.id}/new-mentions`);
      }
    });
  },

  _subscribeToUserTrackingChannel() {
    this.messageBus.subscribe(
      `/chat/user-tracking-state/${this.currentUser.id}`,
      (busData, _, messageId) => {
        if (
          this.lastUserTrackingMessageId &&
          messageId !== this.lastUserTrackingMessageId + 1
        ) {
          return this.forceRefreshChannels();
        } else {
          this.lastUserTrackingMessageId = messageId;
        }

        const trackingState = this.currentUser.chat_channel_tracking_state[
          busData.chat_channel_id
        ];
        if (trackingState) {
          trackingState.chat_message_id = busData.chat_message_id;
          trackingState.unread_count = 0;
          trackingState.unread_mentions = 0;
          this.userChatChannelTrackingStateChanged();
        }
      }
    );
  },

  _unsubscribeFromUserTrackingChannel() {
    this.messageBus.unsubscribe(
      `/chat/user-tracking-state/${this.currentUser.id}`
    );
  },

  userChatChannelTrackingStateChanged() {
    this._recalculateUnreadMessages();
  },

  _recalculateUnreadMessages() {
    let unreadPublicCount = 0;
    let unreadUrgentCount = 0;
    let headerNeedsRerender = false;

    Object.values(this.currentUser.chat_channel_tracking_state).forEach(
      (state) => {
        if (state.muted) {
          return;
        }

        if (state.chatable_type === "DirectMessageChannel") {
          unreadUrgentCount += state.unread_count || 0;
        } else {
          unreadUrgentCount += state.unread_mentions || 0;
          unreadPublicCount += state.unread_count || 0;
        }
      }
    );

    let hasUnreadPublic = unreadPublicCount > 0;
    if (hasUnreadPublic !== this.getHasUnreadMessages()) {
      headerNeedsRerender = true;
      this.setHasUnreadMessages(hasUnreadPublic);
    }

    if (unreadUrgentCount !== this.getUnreadUrgentCount()) {
      headerNeedsRerender = true;
      this.setUnreadUrgentCount(unreadUrgentCount);
    }

    this.currentUser.notifyPropertyChange("chat_channel_tracking_state");
    if (headerNeedsRerender) {
      this.appEvents.trigger("chat:rerender-header");
      this.appEvents.trigger("notifications:changed");
    }
  },

  processChannel(channel) {
    channel = EmberObject.create(channel);
    this._subscribeToSingleUpdateChannel(channel);
    this._updateUserTrackingState(channel);
    channel.chat_channels = channel.chat_channels.map((nested_channel) => {
      return this.processChannel(nested_channel);
    });
    this.allChannels.push(channel);
    return channel;
  },

  _updateUserTrackingState(channel) {
    this.currentUser.chat_channel_tracking_state[channel.id] = {
      muted: channel.muted,
      unread_count: channel.unread_count,
      unread_mentions: channel.unread_mentions,
      chatable_type: channel.chatable_type,
      chat_message_id: channel.last_read_message_id,
    };
  },

  addToolbarButton(toolbarButton) {
    addChatToolbarButton(toolbarButton);
  },
});

const MARKDOWN_OPTIONS = {
  features: {
    anchor: true,
    "auto-link": true,
    bbcode: true,
    "bbcode-block": true,
    "bbcode-inline": true,
    "bold-italics": true,
    "category-hashtag": true,
    censored: true,
    checklist: false,
    code: true,
    "custom-typographer-replacements": false,
    "d-wrap": false,
    details: false,
    "discourse-local-dates": true,
    emoji: true,
    emojiShortcuts: true,
    html: false,
    "html-img": true,
    "inject-line-number": true,
    inlineEmoji: true,
    linkify: true,
    mentions: true,
    newline: true,
    onebox: true,
    paragraph: false,
    policy: false,
    poll: false,
    quote: true,
    quotes: true,
    "resize-controls": false,
    table: true,
    "text-post-process": true,
    unicodeUsernames: false,
    "upload-protocol": true,
    "watched-words": true,
  },
};
