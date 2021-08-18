import EmberObject from "@ember/object";
import Service, { inject as service } from "@ember/service";
import { ajax } from "discourse/lib/ajax";
import { A } from "@ember/array";
import { observes } from "discourse-common/utils/decorators";
import { Promise } from "rsvp";

export const LIST_VIEW = "list_view";
export const CHAT_VIEW = "chat_view";
export default Service.extend({
  messageId: null,
  chatOpen: false,
  hasUnreadPublicMessages: false,
  unreadDirectMessageCount: null,
  publicChannels: null,
  directMessageChannels: null,
  hasFetchedChannels: false,
  appEvents: service(),

  init() {
    this._super(...arguments);
    this._subscribeToUpdateChannels();
    this._subscribeToUserTrackingChannel();
  },

  willDestroy() {
    this._unsubscribeFromUpdateChannels();
    this._unsubscribeFromUserTrackingChannel();
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

  setChatOpenStatus(status) {
    this.set("chatOpen", status);
  },
  getChatOpenStatus() {
    return this.chatOpen;
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
            return this.convertChannelToEmberObj(channel);
          })
        ),
        directMessageChannels: A(
          channels.direct_message_channels.map((channel) => {
            return this.convertChannelToEmberObj(channel);
          })
        ),
        hasFetchedChannels: true,
      });
      return {
        publicChannels: this.publicChannels,
        directMessageChannels: this.directMessageChannels,
      };
    });
  },

  convertChannelToEmberObj(channel) {
    channel = EmberObject.create(channel);
    channel.chat_channels = channel.chat_channels.map((nested_channel) => {
      return this.convertChannelToEmberObj(nested_channel);
    });
    return channel;
  },

  _subscribeToUpdateChannels() {
    Object.keys(this.currentUser.chat_channel_tracking_state).forEach(
      (channelId) => {
        this._subscribeToSingleUpdateChannel(channelId);
      }
    );
    this.messageBus.subscribe("/chat/new-direct-message-channel", (busData) => {
      this.directMessageChannels.pushObject(
        this.convertChannelToEmberObj(busData.chat_channel)
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
        this.messageBus.unsubscribe(`/chat/${channelId}/new_messages`);
      }
    );
    this.messageBus.unsubscribe("/chat/new-direct-message-channel");
  },

  _subscribeToSingleUpdateChannel(channelId) {
    this.messageBus.subscribe(`/chat/${channelId}/new_messages`, (busData) => {
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
});
