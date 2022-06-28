import DiscourseRoute from "discourse/routes/discourse";
import Promise from "rsvp";
import EmberObject, { action } from "@ember/object";
import { ajax } from "discourse/lib/ajax";
import { inject as service } from "@ember/service";
import ChatChannel from "discourse/plugins/discourse-chat/discourse/models/chat-channel";

export default DiscourseRoute.extend({
  chat: service(),

  async model(params) {
    let [chatChannel, channels] = await Promise.all([
      this.getChannel(params.channelId),
      this.chat.getChannels(),
    ]);

    return EmberObject.create({
      chatChannel,
      channels,
    });
  },

  async getChannel(id) {
    let channel = await this.chat.getChannelBy("id", id);
    if (!channel || this.forceRefetchChannel) {
      channel = await this.getChannelFromServer(id);
    }
    return channel;
  },

  async getChannelFromServer(id) {
    return ajax(`/chat/chat_channels/${id}`)
      .then((response) => {
        return response.chat_channel;
      })
      .catch(() => this.replaceWith("/404"));
  },

  afterModel(model) {
    this.appEvents.trigger("chat:navigated-to-full-page");
    this.chat.setActiveChannel(model?.chatChannel);
  },

  setupController(controller) {
    this._super(...arguments);

    if (controller.messageId) {
      this.chat.set("messageId", controller.messageId);
      this.controller.set("messageId", null);
    }
  },

  @action
  refreshModel(forceRefetchChannel = false) {
    this.forceRefetchChannel = forceRefetchChannel;
    this.refresh();
  },
});
