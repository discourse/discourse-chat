import Component from "@ember/component";
import discourseComputed from "discourse-common/utils/decorators";
import showModal from "discourse/lib/show-modal";
import { action, computed } from "@ember/object";
import { schedule } from "@ember/runloop";
import { inject as service } from "@ember/service";

export default Component.extend({
  classNames: "tc-channels",
  publicChannels: null,
  directMessageChannels: null,
  creatingDmChannel: false,
  inSidebar: false,
  toggleSection: null,
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
      return this.directMessageChannels
        ? this.directMessageChannels.sortBy("updated_at").reverse()
        : [];
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
