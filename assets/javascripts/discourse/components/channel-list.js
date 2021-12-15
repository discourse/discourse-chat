import Component from "@ember/component";
import discourseComputed from "discourse-common/utils/decorators";
import showModal from "discourse/lib/show-modal";
import { action, computed } from "@ember/object";
import { schedule } from "@ember/runloop";
import { inject as service } from "@ember/service";
import { empty } from "@ember/object/computed";

export default Component.extend({
  classNames: "tc-channels",
  publicChannels: null,
  directMessageChannels: null,
  creatingDmChannel: false,
  inSidebar: false,
  toggleSection: null,
  publicChannelsEmpty: empty("publicChannels"),
  chat: service(),

  didInsertElement() {
    this._super(...arguments);
    this.appEvents.on("chat:start-new-dm", this, "startCreatingDmChannel");
  },

  willDestroyElement() {
    this._super(...arguments);
    this.appEvents.off("chat:start-new-dm", this, "startCreatingDmChannel");
  },

  sortedDirectMessageChannels: computed(
    "directMessageChannels.@each.updated_at",
    function () {
      if (!this.directMessageChannels?.length) {
        return [];
      }

      return this.directMessageChannels
        .sort((a, b) => {
          const unreadCountA =
            this.currentUser.chat_channel_tracking_state[a.id]?.unread_count ||
            0;
          const unreadCountB =
            this.currentUser.chat_channel_tracking_state[b.id]?.unread_count ||
            0;
          if (unreadCountA === unreadCountB) {
            return new Date(a.updated_at) > new Date(b.updated_at) ? -1 : 1;
          } else {
            return unreadCountA > unreadCountB ? -1 : 1;
          }
        })
        .slice(0, this.currentUser.chat_isolated ? 20 : 10);
    }
  ),

  @discourseComputed("inSidebar")
  publicChannelClasses(inSidebar) {
    return `chat-channels-container public-channels ${
      inSidebar ? "collapsible-sidebar-section" : ""
    }`;
  },
  @discourseComputed("inSidebar")
  directMessageChannelClasses(inSidebar) {
    return `chat-channels-container direct-message-channels ${
      inSidebar ? "collapsible-sidebar-section" : ""
    }`;
  },

  @action
  startCreatingDmChannel() {
    this.set("creatingDmChannel", true);
    schedule("afterRender", () => {
      if (!this.element || this.isDestroying || this.isDestroyed) {
        return;
      }

      const userChooser = this.element.querySelector(
        ".dm-creation-row .dm-user-chooser .select-kit-header"
      );
      if (userChooser) {
        userChooser.click();
      }
    });
  },

  @action
  afterDmCreation(chatChannel) {
    this.cancelDmCreation();
    this.onSelect(chatChannel);
  },

  @action
  cancelDmCreation() {
    this.set("creatingDmChannel", false);
  },

  @action
  toggleChannelSection(section) {
    this.toggleSection(section);
  },

  @action
  openChannelSettingsModal() {
    showModal("chat-channel-settings");
  },
});
