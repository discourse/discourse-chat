import EmberObject from "@ember/object";
import Service, { inject as service } from "@ember/service";
import { ajax } from "discourse/lib/ajax";
import { A } from "@ember/array";
import { generateCookFunction } from "discourse/lib/text";
import { observes } from "discourse-common/utils/decorators";
import { Promise } from "rsvp";
import simpleCategoryHashMentionTransform from "discourse/plugins/discourse-topic-chat/discourse/lib/simple-category-hash-mention-transform";
import { defaultHomepage } from "discourse/lib/utilities";

export const LIST_VIEW = "list_view";
export const CHAT_VIEW = "chat_view";

export default Service.extend({
  allChannels: null,
  appEvents: service(),
  chatOpen: false,
  cook: null,
  directMessageChannels: null,
  hasFetchedChannels: false,
  hasUnreadPublicMessages: false,
  idToTitleMap: null,
  lastNonChatRoute: null,
  messageId: null,
  presence: service(),
  presenceChannel: null,
  publicChannels: null,
  sidebarActive: false,
  unreadDirectMessageCount: null,

  init() {
    this._super(...arguments);
    if (this.currentUser?.can_chat) {
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

    if (this.currentUser?.can_chat) {
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

    this.refreshChannels().then(() => {
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

  setUnreadDirectMessageCount(count) {
    this.set("unreadDirectMessageCount", count);
  },
  getUnreadDirectMessageCount() {
    return this.unreadDirectMessageCount;
  },

  getChannels() {
    if (this.hasFetchedChannels) {
      return Promise.resolve({
        publicChannels: this.publicChannels,
        directMessageChannels: this.directMessageChannels,
      });
    } else {
      return this.refreshChannels();
    }
  },

  refreshChannels() {
    this._unsubscribeFromAllChatChannels();
    this.currentUser.chat_channel_tracking_state = {};
    return ajax("/chat/chat_channels.json").then((channels) => {
      this.setProperties({
        publicChannels: A(
          channels.public_channels.map((channel) => {
            return this.processChannel(channel);
          })
        ),
        directMessageChannels: A(
          channels.direct_message_channels.map((channel) => {
            return this.processChannel(channel);
          })
        ),
        hasFetchedChannels: true,
      });
      const idToTitleMap = {};
      this.allChannels.forEach((c) => {
        idToTitleMap[c.id] = c.title;
      });
      this.set("idToTitleMap", idToTitleMap);
      this.presenceChannel.subscribe(channels.global_presence_channel_state);
      this.currentUser.notifyPropertyChange("chat_channel_tracking_state");
      return {
        publicChannels: this.publicChannels,
        directMessageChannels: this.directMessageChannels,
      };
    });
  },

  getChannelBy(key, value) {
    return this.getChannels().then(() => {
      if (!isNaN(value)) {
        value = parseInt(value, 10);
      }
      return this.allChannels.findBy(key, value);
    });
  },

  getIdealFirstChannelId() {
    // Returns the channel ID of the first direct message channel with unread messages if one exists.
    // Otherwise returns the ID of the first public channel with unread messages.
    // If there is no channel ID to enter, return null and handle the fallback in the consumer.
    return this.getChannels().then(() => {
      let publicChannelIdWithUnread;
      let dmChannelIdWithUnread;

      for (const [channelId, state] of Object.entries(
        this.currentUser.chat_channel_tracking_state
      )) {
        if (state.chatable_type === "DirectMessageChannel") {
          if (!dmChannelIdWithUnread && state.unread_count > 0) {
            dmChannelIdWithUnread = channelId;
            break;
          }
        } else {
          if (!publicChannelIdWithUnread && state.unread_count > 0) {
            publicChannelIdWithUnread = channelId;
          }
        }
      }
      return dmChannelIdWithUnread || publicChannelIdWithUnread;
    });
  },

  getIdealFirstChannelTitle() {
    return this.getIdealFirstChannelId().then((channelId) => {
      if (channelId) {
        return this.idToTitleMap[channelId];
      } else {
        return this.publicChannels[0].title;
      }
    });
  },

  _subscribeToNewDmChannelUpdates() {
    this.messageBus.subscribe("/chat/new-direct-message-channel", (busData) => {
      this.directMessageChannels.pushObject(
        this.processChannel(busData.chat_channel)
      );
      this.currentUser.chat_channel_tracking_state[busData.chat_channel.id] = {
        unread_count: 0,
        chatable_type: "DirectMessageChannel",
      };
      this.currentUser.notifyPropertyChange("chat_channel_tracking_state");
    });
  },

  _unsubscribeFromNewDmChannelUpdates() {
    this.messageBus.unsubscribe("/chat/new-direct-message-channel");
  },

  _subscribeToSingleUpdateChannel(channel) {
    if (channel.muted) {
      return;
    }

    this.messageBus.subscribe(`/chat/${channel.id}/new-messages`, (busData) => {
      if (busData.user_id === this.currentUser.id) {
        // User sent message, update tracking state to no unread
        this.currentUser.chat_channel_tracking_state[
          channel.id
        ].chat_message_id = busData.message_id;
      } else {
        // Message from other user. Incriment trackings state
        this.currentUser.chat_channel_tracking_state[channel.id].unread_count =
          this.currentUser.chat_channel_tracking_state[channel.id]
            .unread_count + 1;
      }
      this.currentUser.notifyPropertyChange("chat_channel_tracking_state");

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

  _unsubscribeFromAllChatChannels() {
    this.allChannels.forEach((channel) => {
      this.messageBus.unsubscribe(`/chat/${channel.id}/new-messages`);
    });
  },

  _subscribeToUserTrackingChannel() {
    this.messageBus.subscribe(
      `/chat/user-tracking-state/${this.currentUser.id}`,
      (busData) => {
        const channelData = this.currentUser.chat_channel_tracking_state[
          busData.chat_channel_id
        ];
        if (channelData) {
          channelData.chat_message_id = busData.chat_message_id;
          channelData.unread_count = 0;
          this.currentUser.notifyPropertyChange("chat_channel_tracking_state");
        }
      }
    );
  },

  _unsubscribeFromUserTrackingChannel() {
    this.messageBus.unsubscribe(
      `/chat/user-tracking-state/${this.currentUser.id}`
    );
  },

  @observes("currentUser.chat_channel_tracking_state")
  _listenForUnreadMessageChanges() {
    this.calculateHasUnreadMessages();
  },

  calculateHasUnreadMessages() {
    let unreadPublicCount = 0;
    let unreadDmCount = 0;
    let headerNeedsRerender = false;

    Object.values(this.currentUser.chat_channel_tracking_state).forEach(
      (state) => {
        state.chatable_type === "DirectMessageChannel"
          ? (unreadDmCount += state.unread_count || 0)
          : (unreadPublicCount += state.unread_count || 0);
      }
    );

    let hasUnreadPublic = unreadPublicCount > 0;
    if (hasUnreadPublic !== this.getHasUnreadMessages()) {
      headerNeedsRerender = true;
      this.setHasUnreadMessages(hasUnreadPublic);
    }

    if (unreadDmCount !== this.getUnreadDirectMessageCount()) {
      headerNeedsRerender = true;
      this.setUnreadDirectMessageCount(unreadDmCount);
    }

    if (headerNeedsRerender) {
      this.appEvents.trigger("chat:rerender-header");
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
      chatable_type: channel.chatable_type,
      chat_message_id: channel.last_read_message_id,
    };
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
    "discourse-local-dates": false,
    emoji: true,
    emojiShortcuts: true,
    html: false,
    "html-img": true,
    "inject-line-number": true,
    inlineEmoji: true,
    linkify: true,
    mentions: true,
    newline: true,
    onebox: false,
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
