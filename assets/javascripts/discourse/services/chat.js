import EmberObject from "@ember/object";
import Service, { inject as service } from "@ember/service";
import { ajax } from "discourse/lib/ajax";
import { A } from "@ember/array";
import { generateCookFunction } from "discourse/lib/text";
import { observes } from "discourse-common/utils/decorators";
import { Promise } from "rsvp";
import simpleCategoryHashMentionTransform from "discourse/plugins/discourse-topic-chat/discourse/lib/simple-category-hash-mention-transform";

export const LIST_VIEW = "list_view";
export const CHAT_VIEW = "chat_view";

export default Service.extend({
  messageId: null,
  chatOpen: false,
  hasUnreadPublicMessages: false,
  allChannels: null,
  unreadDirectMessageCount: null,
  publicChannels: null,
  directMessageChannels: null,
  hasFetchedChannels: false,
  idToTitleMap: null,
  appEvents: service(),
  cook: null,
  presence: service(),
  presenceChannel: null,

  init() {
    this._super(...arguments);
    if (this.currentUser?.can_chat) {
      this.set("allChannels", []);
      this._subscribeToUpdateChannels();
      this._subscribeToUserTrackingChannel();
      this.presenceChannel = this.presence.getChannel("/chat/online");
    }
  },

  willDestroy() {
    this._super(...arguments);

    if (this.currentUser?.can_chat) {
      this.set("allChannels", null);
      this._unsubscribeFromUpdateChannels();
      this._unsubscribeFromUserTrackingChannel();
    }
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
    this.set("loading", true);
    return ajax("/chat/index.json").then((channels) => {
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

  _subscribeToUpdateChannels() {
    Object.keys(this.currentUser.chat_channel_tracking_state).forEach(
      (channelId) => {
        this._subscribeToSingleUpdateChannel(channelId);
      }
    );
    this.messageBus.subscribe("/chat/new-direct-message-channel", (busData) => {
      this.directMessageChannels.pushObject(
        this.processChannel(busData.chat_channel)
      );
      this.currentUser.chat_channel_tracking_state[busData.chat_channel.id] = {
        unread_count: 0,
        chatable_type: "DirectMessageChannel",
      };
      this.currentUser.notifyPropertyChange("chat_channel_tracking_state");
      this._subscribeToSingleUpdateChannel(busData.chat_channel.id);
    });
  },

  _unsubscribeFromUpdateChannels() {
    Object.keys(this.currentUser.chat_channel_tracking_state).forEach(
      (channelId) => {
        this.messageBus.unsubscribe(`/chat/${channelId}/new-messages`);
      }
    );
    this.messageBus.unsubscribe("/chat/new-direct-message-channel");
  },

  _subscribeToSingleUpdateChannel(channelId) {
    this.messageBus.subscribe(`/chat/${channelId}/new-messages`, (busData) => {
      if (busData.user_id === this.currentUser.id) {
        // User sent message, update tracking state to no unread
        this.currentUser.chat_channel_tracking_state[
          channelId
        ].chat_message_id = busData.message_id;
      } else {
        // Message from other user. Incriment trackings state
        this.currentUser.chat_channel_tracking_state[channelId].unread_count =
          this.currentUser.chat_channel_tracking_state[channelId].unread_count +
          1;
      }
      this.currentUser.notifyPropertyChange("chat_channel_tracking_state");

      // Update updated_at timestamp for channel if direct message
      const dmChatChannel = (this.directMessageChannels || []).findBy(
        "id",
        parseInt(channelId, 10)
      );
      if (dmChatChannel) {
        dmChatChannel.set("updated_at", new Date());
        this.notifyPropertyChange("directMessageChannels");
      }
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
    channel.chat_channels = channel.chat_channels.map((nested_channel) => {
      return this.processChannel(nested_channel);
    });
    this.allChannels.push(channel);
    return channel;
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
