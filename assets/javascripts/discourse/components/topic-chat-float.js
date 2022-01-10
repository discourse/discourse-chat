import Component from "@ember/component";
import discourseComputed, { observes } from "discourse-common/utils/decorators";
import getURL from "discourse-common/lib/get-url";
import popupAjaxError from "discourse/lib/ajax-error";
import { action } from "@ember/object";
import {
  CHAT_VIEW,
  LIST_VIEW,
} from "discourse/plugins/discourse-chat/discourse/services/chat";
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
    if (!this.currentUser?.has_chat_enabled) {
      return;
    }

    this._checkSize();
    this.appEvents.on("chat:navigated-to-full-page", this, "close");
    this.appEvents.on("chat:toggle-open", this, "toggleChat");
    this.appEvents.on(
      "chat:open-channel-for-chatable",
      this,
      "openChannelForChatable"
    );
    this.appEvents.on("chat:open-channel", this, "switchChannel");
    this.appEvents.on(
      "chat:open-channel-at-message",
      this,
      "openChannelAtMessage"
    );
    this.appEvents.on("chat:refresh-channels", this, "refreshChannels");
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
    if (!this.currentUser?.has_chat_enabled) {
      return;
    }

    if (this.appEvents) {
      this.appEvents.off("chat:navigated-to-full-page", this, "close");
      this.appEvents.off("chat:toggle-open", this, "toggleChat");
      this.appEvents.off(
        "chat:open-channel-for-chatable",
        this,
        "openChannelForChatable"
      );
      this.appEvents.off("chat:open-channel", this, "switchChannel");
      this.appEvents.off(
        "chat:open-channel-at-message",
        this,
        "openChannelAtMessage"
      );
      this.appEvents.off("chat:refresh-channels", this, "refreshChannels");
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
    this.chat.set("chatOpen", !this.hidden);
    this.appEvents.trigger("chat:rerender-header");
  },

  async openChannelForChatable(channel) {
    if (!channel) {
      return;
    }
    // Check to see if channel is followed or not.
    // If it is, switch channel. If not, start following then switch.
    const isFollowed = await this.chat.isChannelFollowed(channel);
    if (!isFollowed) {
      ajax(`/chat/chat_channels/${channel.id}/follow`, { method: "POST" })
        .then(() => {
          this.chat.startTrackingChannel(channel);
          this.switchChannel(channel);
        })
        .catch(popupAjaxError);
    } else {
      this.switchChannel(channel);
    }
  },

  openChannelAtMessage(channel, messageId) {
    if (this.activeChannel?.id === channel.id) {
      // Already have this channel open. Fire app event to notify chat-pane
      // to highlight or fetch the message.
      this.appEvents.trigger("chat-pane:highlight-message", messageId);
    } else {
      this.chat.set("messageId", messageId);
      this.switchChannel(channel);
    }
  },

  chatEnabledForTopic(topic) {
    if (
      !this.activeChannel ||
      this.activeChannel.id === topic.chat_channel.id
    ) {
      // Don't do anything if viewing another topic
      this.switchChannel(topic.chat_channel);
    }
  },

  chatDisabledForTopic(topic) {
    if (
      !this.hidden &&
      this.activeChannel &&
      this.activeChannel.id === topic.chat_channel.id
    ) {
      this.set("activeChannel", null);
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
  openInFullPage(e) {
    const channel = this.activeChannel;
    if (e.which === 2) {
      // Middle mouse click
      window
        .open(getURL(`/chat/channel/${channel.id}/${channel.title}`), "_blank")
        .focus();
      return false;
    }

    // Set activeChannel to null to avoid a moment where the chat composer is rendered twice.
    // Since the mobile-file-upload button has an ID, a JS error will break things otherwise.
    this.setProperties({
      hidden: true,
      activeChannel: null,
    });
    if (channel) {
      return this.router.transitionTo(
        "chat.channel",
        channel.id,
        channel.title
      );
    }

    this.router.transitionTo("chat");
  },

  @action
  onChannelTitleClick() {
    if (this.expanded && this.activeChannel.chatable_url) {
      this.router.transitionTo(this.activeChannel.chatable_url);
    } else {
      this.set("expanded", true);
    }
  },

  @action
  toggleExpand() {
    this.set("expanded", !this.expanded);
    this.appEvents.trigger("chat:toggle-expand", this.expanded);
  },

  @action
  close() {
    this.setProperties({
      hidden: true,
      expanded: true,
    });
    this.appEvents.trigger("chat:float-toggled", this.hidden);
  },

  @action
  toggleChat() {
    this.set("hidden", !this.hidden);
    this.appEvents.trigger("chat:float-toggled", this.hidden);
    if (this.hidden) {
      return;
    } else {
      this.set("expanded", true);
      this.appEvents.trigger("chat:toggle-expand", this.expanded);
      if (this.activeChannel) {
        // Channel was previously open, so after expand we are done.
        return;
      }
    }

    // Look for DM channel with unread, and fallback to public channel with unread
    this.chat.getIdealFirstChannelId().then((channelId) => {
      if (channelId) {
        this.chat.getChannelBy("id", channelId).then((channel) => {
          this.switchChannel(channel);
        });
      } else {
        // No channels with unread messages. Fetch channel index.
        this.fetchChannels();
      }
    });
  },

  @action
  refreshChannels() {
    if (this.view === LIST_VIEW) {
      this.fetchChannels();
    }
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
    if (this.site.mobileView || this.chat.isChatPage) {
      return this.router.transitionTo(
        "chat.channel",
        channel.id,
        channel.title
      );
    }

    if (this.currentUser.chat_isolated) {
      return window
        .open(getURL(`/chat/channel/${channel.id}/${channel.title}`), "_blank")
        .focus();
    }

    let channelInfo = {
      activeChannel: channel,
      loading: false,
      hidden: false,
      expanded: true,
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
