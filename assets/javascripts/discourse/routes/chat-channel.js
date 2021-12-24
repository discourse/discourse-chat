import DiscourseRoute from "discourse/routes/discourse";
import Promise from "rsvp";
import EmberObject, { action } from "@ember/object";
import { ajax } from "discourse/lib/ajax";
import { defaultHomepage } from "discourse/lib/utilities";
import { inject as service } from "@ember/service";

export default DiscourseRoute.extend({
  chat: service(),

  beforeModel() {
    if (
      !this.currentUser?.has_chat_enabled ||
      !this.siteSettings.chat_enabled
    ) {
      return this.transitionTo(`discovery.${defaultHomepage()}`);
    }
  },

  async model(params) {
    let [[chatChannel, previewing], channels] = await Promise.all([
      this.getChannel(params.channelId),
      this.chat.getChannels(),
    ]);

    return EmberObject.create({ chatChannel, channels, previewing });
  },

  async getChannel(id) {
    let channel = await this.chat.getChannelBy("id", id);
    let previewing = false;
    if (!channel) {
      channel = await this.getChannelFromServer(id);
      previewing = true;
    }
    return [channel, previewing];
  },

  async getChannelFromServer(id) {
    return ajax(`/chat/chat_channels/${id}`)
      .then((response) => {
        return response.chat_channel;
      })
      .catch(() => this.replaceWith("/404"));
  },

  afterModel() {
    this.appEvents.trigger("chat:navigated-to-full-page");
  },

  setupController(controller) {
    this._super(...arguments);

    if (controller.messageId) {
      this.chat.set("messageId", controller.messageId);
      this.controller.set("messageId", null);
    }
  },

  @action
  refreshModel() {
    this.refresh();
  },
});
