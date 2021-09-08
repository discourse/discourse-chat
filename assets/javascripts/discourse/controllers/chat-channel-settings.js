import Controller from "@ember/controller";
import ModalFunctionality from "discourse/mixins/modal-functionality";
import { action } from "@ember/object";
import { ajax } from "discourse/lib/ajax";
import { extractError } from "discourse/lib/ajax-error";
import EmberObject from "@ember/object";

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
    ajax("/chat/all_channels.json").then((channels) => {
      this.setProperties({
        channels: channels.map((channel) => convertToEmberObject(channel)),
        loadingChannels: false,
      });
    });
  },
});
