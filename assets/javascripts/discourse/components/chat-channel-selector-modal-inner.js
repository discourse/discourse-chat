import Component from "@ember/component";
import EmberObject from "@ember/object";
import { action } from "@ember/object";
import { ajax } from "discourse/lib/ajax";
import { bind } from "discourse-common/utils/decorators";
import { schedule } from "@ember/runloop";
import { inject as service } from "@ember/service";
import { popupAjaxError } from "discourse/lib/ajax-error";

export default Component.extend({
  chat: service(),
  tagName: "",
  filter: "",
  channels: null,
  searchIndex: 0,

  init() {
    this._super(...arguments);
    this.appEvents.on("chat-channel-selector-modal:close", this.close);
    this.getInitialChannels();
  },

  didInsertElement() {
    this._super(...arguments);
    document.addEventListener("keydown", this.onKeyDown);
    document
      .getElementById("chat-channel-selector-modal-inner")
      ?.addEventListener("mouseover", this.mouseover);
    document.getElementById("chat-channel-selector-modal-inner")?.focus();
  },

  willDestroyElement() {
    this._super(...arguments);
    this.appEvents.off("chat-channel-selector-modal:close", this.close);
    document.removeEventListener("keydown", this.onKeyDown);
    document
      .getElementById("chat-channel-selector-modal-inner")
      ?.removeEventListener("mouseover", this.mouseover);
  },

  @bind
  mouseover(e) {
    if (e.target.classList.contains("chat-channel-selection-row")) {
      let channel;
      const id = parseInt(e.target.dataset.id, 10);
      if (e.target.classList.contains("channel-row")) {
        channel = this.channels.findBy("id", id);
      } else {
        channel = this.channels.find((c) => c.user && c.id === id);
      }
      channel?.set("focused", true);
      this.channels.forEach((c) => {
        if (c !== channel) {
          c.set("focused", false);
        }
      });
    }
  },

  @bind
  onKeyDown(e) {
    if (e.key === "Enter") {
      let focusedChannel = this.channels.find((c) => c.focused);
      this.switchChannel(focusedChannel);
      e.preventDefault();
    } else if (e.key === "ArrowDown") {
      this.arrowNavigateChannels("down");
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      this.arrowNavigateChannels("up");
      e.preventDefault();
    }
  },

  arrowNavigateChannels(direction) {
    const indexOfFocused = this.channels.findIndex((c) => c.focused);
    if (indexOfFocused > -1) {
      const nextIndex = direction === "down" ? 1 : -1;
      const nextChannel = this.channels[indexOfFocused + nextIndex];
      if (nextChannel) {
        this.channels[indexOfFocused].set("focused", false);
        nextChannel.set("focused", true);
      }
    } else {
      this.channels[0].set("focused", true);
    }

    schedule("afterRender", this, () => {
      let focusedChannel = document.querySelector(
        "#chat-channel-selector-modal-inner .chat-channel-selection-row.focused"
      );
      focusedChannel?.scrollIntoView({ block: "nearest", inline: "start" });
    });
  },

  @action
  switchChannel(channel) {
    if (channel.user) {
      return this.fetchChannelForUser(channel).then((response) => {
        this.chat
          .startTrackingChannel(response.chat_channel)
          .then((newlyTracked) => {
            this.chat.openChannel(newlyTracked);
            this.close();
          });
      });
    } else {
      this.chat.openChannel(channel);
      this.close();
    }
  },

  @action
  search() {
    if (this.filter.trim()) {
      this.fetchChannelsFromServer();
    } else {
      this.getInitialChannels();
    }
  },

  @action
  fetchChannelsFromServer() {
    this.set("searchIndex", this.searchIndex + 1); // This is used to 'cancel' old search requests
    const thisSearchIndex = this.searchIndex;
    ajax("/chat/chat_channels/search", { data: { filter: this.filter } }).then(
      (searchModel) => {
        if (this.searchIndex === thisSearchIndex) {
          this.set("searchModel", searchModel);
          const channels = searchModel.public_channels.concat(
            searchModel.direct_message_channels,
            searchModel.users
          );
          channels.forEach((c) => {
            if (c.username) {
              c.user = true; // This is used by the `chat-channel-selection-row` component
            }
          });
          this.set(
            "channels",
            channels.map((c) => EmberObject.create(c))
          );
          this.focusFirstChannel(this.channels);
        }
      }
    ).catch(popupAjaxError);
  },

  @action
  getInitialChannels() {
    return this.chat.getChannelsWithFilter(this.filter).then((channels) => {
      this.focusFirstChannel(channels);
      this.set("channels", channels);
    });
  },

  @action
  fetchChannelForUser(user) {
    return ajax("/chat/direct_messages/create.json", {
      method: "POST",
      data: { usernames: user.username },
    }).catch(popupAjaxError);
  },

  focusFirstChannel(channels) {
    channels.forEach((c) => c.set("focused", false));
    channels[0]?.set("focused", true);
  },
});
