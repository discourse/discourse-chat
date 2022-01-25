import Component from "@ember/component";
import discourseComputed, { bind } from "discourse-common/utils/decorators";
import discourseDebounce from "discourse-common/lib/debounce";
import { schedule, throttle } from "@ember/runloop";
import { inject as service } from "@ember/service";
import { action } from "@ember/object";

export default Component.extend({
  router: service(),
  chat: service(),
  tagName: "",
  filter: "",
  filteredChannels: null,

  init() {
    this._super(...arguments);
    this.appEvents.on("chat-channel-selector-modal:close", this.close);
    this._getFilteredChannels();
    document.addEventListener("keydown", this.onKeyDown);
  },

  didInsertElement() {
    this._super(...arguments);
    schedule("afterRender", () => {
      document
        .getElementById("chat-channel-selector-modal-inner")
        ?.addEventListener("mouseover", this.mouseover);
    });
  },

  willDestroyElement() {
    this._super(...arguments);
    this.appEvents.off("chat-channel-selector-modal:close", this.close);
    document.removeEventListener("keydown", this.onKeyDown);
    document
      .getElementById("chat-channel-selector-modal-inner")
      ?.removeEventListener("mouseover", this.mouseover);
    this.filteredChannels.forEach((c) => c.set("focused", false));
  },

  @bind
  mouseover(e) {
    if (e.target.classList.contains("chat-channel-row")) {
      this.filteredChannels.forEach((c) => c.set("focused", false));
      const channel = this.filteredChannels.findBy(
        "id",
        parseInt(e.target.dataset.chatChannelId, 10)
      );
      channel?.set("focused", true);
    }
  },

  @bind
  onKeyDown(e) {
    if (e.keyCode === 13) {
      // Enter key
      let focusedChannel = this.filteredChannels.find((c) => c.focused);
      this.switchChannel(focusedChannel);
    } else if (e.keyCode === 40) {
      // Down key
      this.arrowNavigateChannels("down");
    } else if (e.keyCode === 38) {
      // Up key
      this.arrowNavigateChannels("up");
    }
  },

  arrowNavigateChannels(direction) {
    const indexOfFocused = this.filteredChannels.findIndex((c) => c.focused);
    if (indexOfFocused > -1) {
      const nextIndex = direction === "down" ? 1 : -1;
      const nextChannel = this.filteredChannels[indexOfFocused + nextIndex];
      if (nextChannel) {
        this.filteredChannels[indexOfFocused].set("focused", false);
        nextChannel.set("focused", true);
      }
    } else {
      this.filteredChannels[0].set("focused", true);
    }

    schedule("afterRender", this, () => {
      let focusedChannel = document.querySelector(
        "#chat-channel-selector-modal-inner .chat-channel-row.focused"
      );
      if (focusedChannel) {
        focusedChannel.scrollIntoView({ block: "nearest", inline: "start" });
      }
    });
  },

  @action
  switchChannel(channel) {
    this.chat.openChannel(channel);
    this.close();
  },

  _getFilteredChannels() {
    return this.chat.getChannelsWithFilter(this.filter).then((channels) => {
      channels.forEach((c) => c.set("focused", false));
      channels[0]?.set("focused", true);

      this.set("filteredChannels", channels);
    });
  },

  @action
  onFilterChange(filter) {
    discourseDebounce(this, this._getFilteredChannels, 50);
  },
});
