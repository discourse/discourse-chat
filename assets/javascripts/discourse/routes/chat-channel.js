import DiscourseRoute from "discourse/routes/discourse";
import Promise from "rsvp";
import EmberObject, { action } from "@ember/object";
import { ajax } from "discourse/lib/ajax";
import { inject as service } from "@ember/service";

export default DiscourseRoute.extend({
  chat: service(),

  beforeModel() {
    if (!this.currentUser?.chat_on || !this.siteSettings.topic_chat_enabled) {
      this.transitionTo("discovery");
    }
  },

  async model(params) {
    let [[chatChannel, previewing], channels] = await Promise.all([
      this.getChannel(params.channelTitle),
      this.chat.getChannels(),
    ]);

    return EmberObject.create({ chatChannel, channels, previewing });
  },

  async getChannel(title) {
    let channel = await this.chat.getChannelBy("title", title);
    let previewing = false;
    if (!channel) {
      channel = await this.getChannelFromServer(title);
      previewing = true;
    }
    return [channel, previewing];
  },

  async getChannelFromServer(title) {
    return ajax(`/chat/chat_channels/by_title/${title}`)
      .then((response) => {
        return response.chat_channel;
      })
      .catch(() => this.replaceWith("/404"));
  },

  afterModel() {
    this.appEvents.trigger("chat:navigated-to-full-page");
  },

  @action
  refreshModel() {
    this.refresh();
  },
});
