import EmberObject from "@ember/object";
import Service, { inject as service } from "@ember/service";
import Site from "discourse/models/site";
import { addChatToolbarButton } from "discourse/plugins/discourse-chat/discourse/components/chat-composer";
import { ajax } from "discourse/lib/ajax";
import { A } from "@ember/array";
import { defaultHomepage } from "discourse/lib/utilities";
import { generateCookFunction } from "discourse/lib/text";
import { next } from "@ember/runloop";
import { Promise } from "rsvp";
import simpleCategoryHashMentionTransform from "discourse/plugins/discourse-chat/discourse/lib/simple-category-hash-mention-transform";

export const LIST_VIEW = "list_view";
export const CHAT_VIEW = "chat_view";

const CHAT_ONLINE_OPTIONS = {
  userUnseenTime: 60000, // 60 seconds with no interaction
  browserHiddenTime: 60000, // Or the browser has been in the background for 60 seconds
};

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
        (c) => c.id.toString(10) === this.router.currentRoute.params.channelId
      );
      if (currentChannel && !currentChannel.following) {
        this.router.transitionTo(`discovery.${defaultHomepage()}`);
      }
    }

    this.forceRefreshChannels().then(() => {
      // Check if modal was opened from the chat index. If so and there is a newly tracked channel, navigate to it
      if (
        modal.controller.openedOnRouteName === "chat.index" &&
        modal.controller.newlyFollowedChannel
      ) {
        this.router.transitionTo(
          "chat.channel",
          modal.controller.newlyFollowedChannel.id,
          modal.controller.newlyFollowedChannel.title
        );
      }
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

    const prettyTextFeatures = {
      features: Site.currentProp("chat_pretty_text_features"),
    };
    return generateCookFunction(prettyTextFeatures).then((cookFunction) => {
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
    next(() => {
      if (this.fullScreenChatOpen || this.chatOpen) {
        this.presenceChannel.enter({ activeOptions: CHAT_ONLINE_OPTIONS });
      } else {
        this.presenceChannel.leave();
      }
    });
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

  async isChannelFollowed(channel) {
    return this.getChannelBy("id", channel.id);
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
      this.setProperties({
        loading: true,
        allChannels: [],
      });
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
        this.appEvents.trigger("chat:refresh-channels");
        resolve(this._channelObject());
      });
    });
  },

  async getChannelBy(key, value) {
    return this.getChannels().then(() => {
      if (!isNaN(value)) {
        value = parseInt(value, 10);
      }
      return (this.allChannels || []).findBy(key, value);
    });
  },

  getIdealFirstChannelId() {
    // When user opens chat we need to give them the 'best' channel when they enter.
    // Look for public channels with mentions. If one exists, enter that.
    // Next best is a DM channel with unread messages.
    // Next best is a public channel with unread messages.
    return this.getChannels().then(() => {
      // Defined in order of significance.
      let publicChannelWithMention,
        dmChannelWithUnread,
        publicChannelWithUnread,
        publicChannel,
        dmChannel;

      for (const [channel, state] of Object.entries(
        this.currentUser.chat_channel_tracking_state
      )) {
        if (state.chatable_type === "DirectMessageChannel") {
          if (!dmChannelWithUnread && state.unread_count > 0) {
            dmChannelWithUnread = channel;
          } else if (!dmChannel) {
            dmChannel = channel;
          }
        } else {
          if (!publicChannelWithMention && state.unread_mentions > 0) {
            publicChannelWithMention = channel;
            break; // <- We have a public channel with a mention. Break and return this.
          } else if (!publicChannelWithUnread && state.unread_count > 0) {
            publicChannelWithUnread = channel;
          } else if (!publicChannel) {
            publicChannel = channel;
          }
        }
      }
      return (
        publicChannelWithMention ||
        dmChannelWithUnread ||
        publicChannelWithUnread ||
        publicChannel ||
        dmChannel
      );
    });
  },

  getIdealFirstChannelIdAndTitle() {
    return this.getIdealFirstChannelId().then((channelId) => {
      if (!channelId) {
        return;
      }
      return {
        id: channelId,
        title: this.idToTitleMap[channelId],
      };
    });
  },

  async openChannelAtMessage(channelId, messageId) {
    let channel = await this.getChannelBy("id", channelId);
    if (channel) {
      return this._openFoundChannelAtMessage(channel, messageId);
    }

    return ajax(`/chat/chat_channels/${channelId}`).then((response) => {
      this.router.transitionTo(
        "chat.channel",
        response.chat_channel.id,
        response.chat_channel.title,
        {
          queryParams: { messageId },
        }
      );
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
      this.router.currentRouteName === "chat.channel" ||
      this.currentUser.chat_isolated
    ) {
      this.router.transitionTo("chat.channel", channel.id, channel.title, {
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

  async startTrackingChannel(channel) {
    const existingChannel = await this.getChannelBy("id", channel.id);
    if (existingChannel) {
      return; // User is already tracking this channel. return!
    }

    const existingChannels =
      channel.chatable_type === "DirectMessageChannel"
        ? this.directMessageChannels
        : this.publicChannels;

    existingChannels.pushObject(this.processChannel(channel));
    this.currentUser.chat_channel_tracking_state[channel.id] = {
      unread_count: 0,
      unread_mentions: 0,
      chatable_type: channel.chatable_type,
    };
    this.userChatChannelTrackingStateChanged();
    this.appEvents.trigger("chat:refresh-channels");
  },

  async stopTrackingChannel(channel) {
    const existingChannel = await this.getChannelBy("id", channel.id);
    if (existingChannel) {
      this.forceRefreshChannels();
    }
  },

  _subscribeToNewDmChannelUpdates() {
    this.messageBus.subscribe("/chat/new-direct-message-channel", (busData) => {
      this.startTrackingChannel(busData.chat_channel);
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

  resetTrackingStateForChannel(channelId) {
    const trackingState = this.currentUser.chat_channel_tracking_state[
      channelId
    ];
    if (trackingState) {
      trackingState.unread_count = 0;
      this.userChatChannelTrackingStateChanged();
    }
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
