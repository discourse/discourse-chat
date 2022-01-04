import Component from "@ember/component";
import discourseComputed from "discourse-common/utils/decorators";
import showModal from "discourse/lib/show-modal";
import { action, computed } from "@ember/object";
import { schedule } from "@ember/runloop";
import { inject as service } from "@ember/service";
import { empty } from "@ember/object/computed";
import I18n from "I18n";

export default Component.extend({
  tagName: "",
  publicChannels: null,
  directMessageChannels: null,
  creatingDmChannel: false,
  inSidebar: false,
  toggleSection: null,
  publicChannelsEmpty: empty("publicChannels"),
  chat: service(),
  router: service(),
  onSelect: null,

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

  @computed
  get channelsActions() {
    return [
      { id: "browseChannels", name: I18n.t("chat.channel_list_popup.browse") },
      {
        id: "openCreateChannelModal",
        name: I18n.t("chat.channel_list_popup.create"),
      },
    ];
  },

  @action
  handleChannelAction(id) {
    this[id]();
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
      if (this.isDestroying || this.isDestroyed) {
        return;
      }

      const userChooser = document.querySelector(
        ".dm-creation-row .dm-user-chooser .select-kit-header"
      );
      userChooser?.click();
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
