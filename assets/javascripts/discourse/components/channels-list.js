import { bind } from "discourse-common/utils/decorators";
import Component from "@ember/component";
import showModal from "discourse/lib/show-modal";
import { action, computed } from "@ember/object";
import { schedule } from "@ember/runloop";
import { inject as service } from "@ember/service";
import { empty, reads } from "@ember/object/computed";
import I18n from "I18n";
import { DRAFT_CHANNEL_VIEW } from "discourse/plugins/discourse-chat/discourse/services/chat";

export default class ChannelsList extends Component {
  @service chat;
  @service router;
  tagName = "";
  inSidebar = false;
  toggleSection = null;
  onSelect = null;
  @reads("chat.publicChannels.[]") publicChannels;
  @reads("chat.directMessageChannels.[]") directMessageChannels;
  @empty("publicChannels") publicChannelsEmpty;

  @computed("directMessageChannels.@each.last_message_sent_at")
  get sortedDirectMessageChannels() {
    if (!this.directMessageChannels?.length) {
      return [];
    }

    return this.chat.truncateDirectMessageChannels(
      this.chat.sortDirectMessageChannels(this.directMessageChannels)
    );
  }

  @computed("inSidebar")
  get publicChannelClasses() {
    return `channels-list-container public-channels ${
      this.inSidebar ? "collapsible-sidebar-section" : ""
    }`;
  }

  @computed("inSidebar")
  get directMessageChannelClasses() {
    return `channels-list-container direct-message-channels ${
      this.inSidebar ? "collapsible-sidebar-section" : ""
    }`;
  }

  @action
  browseChannels() {
    this.router.transitionTo("chat.browse");
    return false;
  }

  @computed
  get channelsActions() {
    return [
      { id: "browseChannels", name: I18n.t("chat.channels_list_popup.browse") },
      {
        id: "openCreateChannelModal",
        name: I18n.t("chat.channels_list_popup.create"),
      },
    ];
  }

  @action
  handleChannelAction(id) {
    if (!this.channelsActions.map((a) => a.id).includes(id)) {
      throw new Error(`The action ${id} is not allowed`);
    }
    this[id]();
  }

  @action
  openCreateChannelModal() {
    showModal("create-channel-modal");
    return false;
  }

  @action
  startCreatingDmChannel() {
    if (
      this.site.mobileView ||
      this.router.currentRouteName.startsWith("chat.")
    ) {
      this.router.transitionTo("chat.draft-channel");
    } else {
      this.appEvents.trigger("chat:open-view", DRAFT_CHANNEL_VIEW);
    }
  }

  @action
  toggleChannelSection(section) {
    this.toggleSection(section);
  }

  didRender() {
    this._super(...arguments);

    schedule("afterRender", this._applyScrollPosition);
  }

  @action
  storeScrollPosition() {
    const scroller = document.querySelector(".channels-list");
    if (scroller) {
      const scrollTop = scroller.scrollTop || 0;
      this.session.set("channels-list-position", scrollTop);
    }
  }

  @bind
  _applyScrollPosition() {
    const data = this.session.get("channels-list-position");
    if (data) {
      const scroller = document.querySelector(".channels-list");
      scroller.scrollTo(0, data);
    }
  }
}
