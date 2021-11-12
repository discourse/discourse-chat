import Component from "@ember/component";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";
import { withPluginApi } from "discourse/lib/plugin-api";

export default Component.extend({
  publicChannels: null,
  directMessageChannels: null,
  toggleSection: null,
  chat: service(),
  router: service(),

  show: false,
  fetchedChannels: false,

  init() {
    this._super(...arguments);

    if (!this.currentUser?.has_chat_enabled) {
      return;
    }
    this.appEvents.on("chat:refresh-channels", this, "fetchChannels");

    withPluginApi("0.12.1", (api) => {
      api.onPageChange(() => {
        this.calcShouldShow();
      });
    });
  },

  willDestoryElement() {
    this._super(...arguments);
    this.appEvents.off("chat:refresh-channels", this, "fetchChannels");
  },

  calcShouldShow() {
    this.set("show", !this.currentUser.chat_isolated || this.chat.onChatPage());
    if (this.show && !this.fetchedChannels) {
      this.fetchChannels();
    }
  },

  @action
  fetchChannels() {
    this.chat.getChannels().then((channels) => {
      this.setProperties({
        publicChannels: channels.publicChannels,
        directMessageChannels: channels.directMessageChannels,
        fetchedChannels: true,
      });
    });
  },

  @action
  switchChannel(channel) {
    if (
      this.site.mobileView ||
      this.router.currentRouteName === "chat.channel"
    ) {
      this.router.transitionTo("chat.channel", channel.id, channel.title);
    } else {
      this.appEvents.trigger("chat:open-channel", channel);
    }
    return false;
  },
});
