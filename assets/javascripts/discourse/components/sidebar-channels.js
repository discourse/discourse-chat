import Component from "@ember/component";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";

export default Component.extend({
  publicChannels: null,
  directMessageChannels: null,
  chat: service(),

  didInsertElement() {
    this._super(...arguments);
    this.fetchChannels();
  },

  @action
  fetchChannels() {
    this.chat.getChannels().then((channels) => {
      this.setProperties({
        publicChannels: channels.publicChannels,
        directMessageChannels: channels.directMessageChannels,
      });
    });
  },

  @action
  switchChannel(channel) {
    this.appEvents.trigger("chat:open-channel", channel);
  },
});
