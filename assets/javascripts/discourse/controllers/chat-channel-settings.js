import Controller from "@ember/controller";
import EmberObject from "@ember/object";
import ModalFunctionality from "discourse/mixins/modal-functionality";
import { ajax } from "discourse/lib/ajax";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";

function convertToEmberObject(channel) {
  channel = EmberObject.create(channel);
  channel.chat_channels = channel.chat_channels.map((c) =>
    EmberObject.create(c)
  );
  return channel;
}
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
        channels: channels.map((channel) => convertToEmberObject(channel)),
        loadingChannels: false,
      });
    });
  },

  @action
  onFollowChannel(channel) {
    this.set("newlyFollowedChannel", channel);
  },
});
