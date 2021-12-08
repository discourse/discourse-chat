import Controller from "@ember/controller";
import EmberObject, { action } from "@ember/object";
import ModalFunctionality from "discourse/mixins/modal-functionality";
import { ajax } from "discourse/lib/ajax";
import { inject as service } from "@ember/service";

export default Controller.extend(ModalFunctionality, {
  channels: null,
  loadingChannels: false,
  newlyFollowedChannel: null,
  router: service(),

  onShow() {
    this.setProperties({
      openedOnRouteName: this.router.currentRouteName,
      loadingChannels: true,
    });
    ajax("/chat/chat_channels/all.json").then((channels) => {
      this.setProperties({
        channels: channels.map((channel) => EmberObject.create(channel)),
        loadingChannels: false,
      });
    });
  },

  @action
  onFollowChannel(channel) {
    this.set("newlyFollowedChannel", channel);
  },
});
