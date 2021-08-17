import Component from "@ember/component";
import discourseComputed, { observes } from "discourse-common/utils/decorators";
import EmberObject, { action, computed } from "@ember/object";
import simpleCategoryHashMentionTransform from "discourse/plugins/discourse-topic-chat/discourse/lib/simple-category-hash-mention-transform";
import { A } from "@ember/array";
import { ajax } from "discourse/lib/ajax";
import { empty, equal } from "@ember/object/computed";
import { cancel, schedule, throttle } from "@ember/runloop";
import { generateCookFunction } from "discourse/lib/text";
import { inject as service } from "@ember/service";

export const LIST_VIEW = "list_view";
export const CHAT_VIEW = "chat_view";
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

export default Component.extend({
  chatView: equal("view", CHAT_VIEW),
  classNameBindings: [":topic-chat-float-container", "hidden"],
  chatService: service("chat"),

  hidden: true,
  loading: false,
  expanded: true, // TODO - false when not first-load topic
  showClose: true, // TODO - false when on same topic
  expectPageChange: false,
  sizeTimer: null,
  rafTimer: null,
  view: null,
  hasUnreadMessages: false,
  activeChannel: null,
  publicChannels: null,
  directMessageChannels: null,
  creatingDmChannel: false,
  newDmUsernames: null,
  newDmUsernamesEmpty: empty("newDmUsernames"),

  didInsertElement() {
    this._super(...arguments);
    if (!this.currentUser || !this.currentUser.can_chat) {
      return;
    }

    this._subscribeToUpdateChannels();
    this._subscribeToUserTrackingChannel();
    this._setHasUnreadMessages();
    this._checkSize();
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

    this._loadCookFunction();
  },
  willDestroyElement() {
    this._super(...arguments);
    if (!this.currentUser || !this.currentUser.can_chat) {
      return;
    }

    if (this.appEvents) {
      this._unsubscribeFromUpdateChannels();
      this._unsubscribeFromUserTrackingChannel();
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

  sortedDirectMessageChannels: computed(
    "directMessageChannels.@each.updated_at",
    function () {
      return this.directMessageChannels
        ? this.directMessageChannels.sortBy("updated_at").reverse()
        : [];
    }
  ),

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
    if (hasUnreadPublic !== this.chatService.getHasUnreadMessages()) {
      headerNeedsRerender = true;
      this.chatService.setHasUnreadMessages(hasUnreadPublic);
    }

    if (unreadDmCount !== this.chatService.getUnreadDirectMessageCount()) {
      headerNeedsRerender = true;
      this.chatService.setUnreadDirectMessageCount(unreadDmCount);
    }

    if (headerNeedsRerender) {
      this.appEvents.trigger("chat:rerender-header");
    }
  },

  _loadCookFunction() {
    return generateCookFunction(MARKDOWN_OPTIONS).then((cookFunction) => {
      return this.set("cookFunction", (raw) => {
        return simpleCategoryHashMentionTransform(
          cookFunction(raw),
          this.site.categories
        );
      });
    });
  },

  openChannelFor(chatable) {
    if (chatable.chat_channel) {
      this.switchChannel(chatable.chat_channel);
    }
  },

  openChannelAtMessage(chatChannelId, messageId) {
    this.chatService.setMessageId(messageId);
    this._fetchChannelAndSwitch(chatChannelId);
  },

  _fetchChannelAndSwitch(chatChannelId) {
    this.set("loading", true);
    console.log(`/chat/${chatChannelId}.json`)
    return ajax(`/chat/${chatChannelId}.json`).then((response) => {
      console.log(response)
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
    this.element.style.setProperty(
      "--composer-right",
      composer.offsetLeft + "px"
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
    Object.keys(this.currentUser.chat_channel_tracking_state).forEach(
      (channelId) => {
        this._subscribeToSingleUpdateChannel(channelId);
      }
    );
    this.messageBus.subscribe("/chat/new-direct-message-channel", (busData) => {
      this.directMessageChannels.pushObject(busData.chat_channel);
      this.currentUser.chat_channel_tracking_state[busData.chat_channel.id] = {
        unread_count: 0,
        chatable_type: "DirectMessageChannel",
      };
      this.currentUser.notifyPropertyChange("chat_channel_tracking_state");
      this._subscribeToSingleUpdateChannel(busData.chat_channel.id);
    });
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

  _unsubscribeFromUpdateChannels() {
    Object.keys(this.currentUser.chat_channel_tracking_state).forEach(
      (channelId) => {
        this.messageBus.unsubscribe(`/chat/${channelId}/new_messages`);
      }
    );
    this.messageBus.unsubscribe("/chat/new-direct-message-channel");
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

  @discourseComputed("expanded", "activeChannel")
  containerClassNames(expanded, activeChannel) {
    const classNames = ["topic-chat-container"];
    if (expanded) {
      classNames.push("expanded");
    }
    if (activeChannel) {
      classNames.push(`channel-${activeChannel.id}`);
    }
    return classNames.join(" ");
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
    return trackingState[activeChannel.id]?.unread_count || 0;
  },

  @action
  toggleExpand() {
    this.set("expanded", !this.expanded);
  },

  @action
  close() {
    this.set("hidden", true);
  },

  @action
  toggleChat() {
    this.set("hidden", !this.hidden);
    if (this.hidden) {
      return;
    } else {
      this.set("expanded", true);
      if (this.activeChannel) {
        // Channel was previously open, so after expand we are done.
        return;
      }
    }

    let publicChannelIdWithUnread;
    let dmChannelIdWithUnread;

    // Look for DM channel with unread, and fallback to public channel with unread
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
    let channelId = dmChannelIdWithUnread || publicChannelIdWithUnread;
    if (channelId) {
      this._fetchChannelAndSwitch(channelId);
    } else {
      // No channels with unread messages. Fetch channel index.
      this.fetchChannels();
    }
  },

  @action
  fetchChannels() {
    this.set("loading", true);
    ajax("/chat/index.json").then((channels) => {
      this.setProperties({
        publicChannels: A(
          channels.public_channels.map((channel) => EmberObject.create(channel))
        ),
        directMessageChannels: A(
          channels.direct_message_channels.map((channel) =>
            EmberObject.create(channel)
          )
        ),
        activeChannel: null,
        loading: false,
        expanded: true,
        view: LIST_VIEW,
      });
    });
  },

  @action
  switchChannel(channel) {
    console.log(channel)
    let channelInfo = {
      activeChannel: channel,
      expanded: this.expectPageChange ? true : this.expanded,
      loading: false,
      hidden: false,
      expectPageChange: false,
      view: CHAT_VIEW,
    };
    this.setProperties(channelInfo);
  },

  @action
  startCreatingDmChannel() {
    this.set("creatingDmChannel", true);
    schedule("afterRender", () => {
      const userChooser = this.element.querySelector(".dm-user-chooser input");
      if (userChooser) {
        userChooser.focus();
      }
    });
  },

  @action
  onChangeNewDmUsernames(usernames) {
    this.set("newDmUsernames", usernames);
  },

  @action
  createDmChannel() {
    if (this.newDmUsernamesEmpty) {
      return;
    }

    return ajax("/chat/direct_messages/create.json", {
      method: "POST",
      data: { usernames: this.newDmUsernames.uniq().join(",") },
    }).then((response) => {
      this.resetDmCreation();
      this.switchChannel(response.chat_channel);
    });
  },

  @action
  resetDmCreation() {
    this.setProperties({
      newDmUsernames: null,
      creatingDmChannel: false,
    });
  },
});
