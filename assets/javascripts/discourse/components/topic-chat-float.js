import Component from "@ember/component";
import discourseComputed, { observes } from "discourse-common/utils/decorators";
import { action } from "@ember/object";
import {
  CHAT_VIEW,
  LIST_VIEW,
} from "discourse/plugins/discourse-topic-chat/discourse/services/chat";

import { ajax } from "discourse/lib/ajax";
import { equal } from "@ember/object/computed";
import { cancel, schedule, throttle } from "@ember/runloop";
import { inject as service } from "@ember/service";

export default Component.extend({
  chatView: equal("view", CHAT_VIEW),
  classNameBindings: [":topic-chat-float-container", "hidden"],
  chat: service(),
  router: service(),

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

  didInsertElement() {
    this._super(...arguments);
    if (!this.currentUser || !this.currentUser.can_chat) {
      return;
    }

    this.chat.calculateHasUnreadMessages();
    this._checkSize();
    this.appEvents.on("chat:navigated-to-full-page", this, "close");
    this.appEvents.on("chat:toggle-open", this, "toggleChat");
    this.appEvents.on("chat:open-channel-for", this, "openChannelFor");
    this.appEvents.on("chat:open-channel", this, "switchChannel");
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
  },
  willDestroyElement() {
    this._super(...arguments);
    if (!this.currentUser || !this.currentUser.can_chat) {
      return;
    }

    if (this.appEvents) {
      this.appEvents.off("chat:navigated-to-full-page", this, "close");
      this.appEvents.off("chat:toggle-open", this, "toggleChat");
      this.appEvents.off("chat:open-channel-for", this, "openChannelFor");
      this.appEvents.off("chat:open-channel", this, "switchChannel");
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
    this.chat.setChatOpenStatus(!this.hidden);
    this.appEvents.trigger("chat:rerender-header");
  },

  openChannelFor(chatable) {
    if (chatable.chat_channel) {
      this.switchChannel(chatable.chat_channel);
    }
  },

  openChannelAtMessage(chatChannelId, messageId) {
    this.chat.setMessageId(messageId);
    this._fetchChannelAndSwitch(chatChannelId);
  },

  _fetchChannelAndSwitch(chatChannelId) {
    this.set("loading", true);
    return ajax(`/chat/${chatChannelId}.json`).then((response) => {
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
  openInFullPage() {
    if (this.activeChannel) {
      return this.router.transitionTo("chat.channel", this.activeChannel.title);
    }

    this.router.transitionTo("chat");
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

    // Look for DM channel with unread, and fallback to public channel with unread
    this.chat.getIdealFirstChannelId().then((channelId) => {
      if (channelId) {
        this._fetchChannelAndSwitch(channelId);
      } else {
        // No channels with unread messages. Fetch channel index.
        this.fetchChannels();
      }
    });
  },

  @action
  fetchChannels() {
    this.set("loading", true);
    this.chat.getChannels().then((channels) => {
      this.setProperties({
        publicChannels: channels.publicChannels,
        directMessageChannels: channels.directMessageChannels,
        activeChannel: null,
        loading: false,
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
