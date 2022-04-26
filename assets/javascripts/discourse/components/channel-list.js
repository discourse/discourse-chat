import { createDirectMessageChannelDraft } from "discourse/plugins/discourse-chat/discourse/models/chat-channel";
import Component from "@ember/component";
import discourseComputed from "discourse-common/utils/decorators";
import showModal from "discourse/lib/show-modal";
import { action, computed } from "@ember/object";
import { inject as service } from "@ember/service";
import { empty, reads } from "@ember/object/computed";
import I18n from "I18n";

export default Component.extend({
  tagName: "",
  publicChannels: reads("chat.publicChannels.[]"),
  directMessageChannels: reads("chat.directMessageChannels.[]"),
  inSidebar: false,
  toggleSection: null,
  publicChannelsEmpty: empty("publicChannels"),
  chat: service(),
  router: service(),
  onSelect: null,

  @discourseComputed("directMessageChannels.@each.last_message_sent_at")
  sortedDirectMessageChannels(channels) {
    if (!channels?.length) {
      return [];
    }

    return this.chat.truncateDirectMessageChannels(
      this.chat.sortDirectMessageChannels(channels)
    );
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
    if (!this.channelsActions.map((a) => a.id).includes(id)) {
      throw new Error(`The action ${id} is not allowed`);
    }
    this[id]();
  },

  @action
  openCreateChannelModal() {
    showModal("create-channel-modal");
    return false;
  },

  @action
  startCreatingDmChannel() {
    return this.onSelect(createDirectMessageChannelDraft());
  },

  @action
  toggleChannelSection(section) {
    this.toggleSection(section);
  },
});
