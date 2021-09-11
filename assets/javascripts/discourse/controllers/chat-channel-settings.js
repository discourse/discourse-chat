import Controller from "@ember/controller";
import EmberObject from "@ember/object";
import ModalFunctionality from "discourse/mixins/modal-functionality";
import { ajax } from "discourse/lib/ajax";

function convertToEmberObject(channel) {
  channel = EmberObject.create(channel);
  channel.chat_channels = channel.chat_channels.map((c) =>
    EmberObject.create(c)
  );
  return channel;
}
export default Controller.extend(ModalFunctionality, {
  loadingChannels: false,
  channels: null,

  onShow() {
    this.set("loadingChannels", true);
    ajax("/chat/chat_channels/all.json").then((channels) => {
      this.setProperties({
        channels: channels.map((channel) => convertToEmberObject(channel)),
        loadingChannels: false,
      });
    });
  },
});
