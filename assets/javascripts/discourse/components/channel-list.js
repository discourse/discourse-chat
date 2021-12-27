import Component from "@ember/component";
import discourseComputed, { bind } from "discourse-common/utils/decorators";
import showModal from "discourse/lib/show-modal";
import { action } from "@ember/object";
import { next, schedule } from "@ember/runloop";
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
  showPopup: false,
  chat: service(),
  router: service(),

  didInsertElement() {
    this._super(...arguments);
    this.appEvents.on("chat:start-new-dm", this, "startCreatingDmChannel");
  },

  willDestroyElement() {
    this._super(...arguments);
    this.appEvents.off("chat:start-new-dm", this, "startCreatingDmChannel");
  },

  @discourseComputed("directMessageChannels.@each.updated_at")
  sortedDirectMessageChannels(channels) {
    if (!channels?.length) {
      return [];
    }

    return this.chat
      .sortDirectMessageChannels(channels)
      .slice(0, this.currentUser.chat_isolated ? 20 : 10);
  },

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
  browseChannels() {
    this.router.transitionTo("chat.browse");
    return false;
  },

  @action
  pencilClicked() {
    if (this.currentUser.staff) {
      this.togglePopupMenu();
    } else {
      this.browseChannels();
    }
    return false;
  },

  @bind
  togglePopupMenu() {
    this.set("showPopup", !this.showPopup);
    next(() => {
      if (this.showPopup) {
        window.addEventListener("click", this.togglePopupMenu);
      } else {
        window.removeEventListener("click", this.togglePopupMenu);
      }
    });
  },

  @action
  openCreateChannelModal() {
    showModal("create-channel-modal");
    return false;
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
});
