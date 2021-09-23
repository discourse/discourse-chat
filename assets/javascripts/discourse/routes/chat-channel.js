import DiscourseRoute from "discourse/routes/discourse";
import Promise from "rsvp";
import { action } from "@ember/object";
import { ajax } from "discourse/lib/ajax";
import { inject as service } from "@ember/service";

export default DiscourseRoute.extend({
  chat: service(),

  beforeModel() {
    if (!this.currentUser?.can_chat || !this.siteSettings.topic_chat_enabled) {
      this.transitionTo("discovery");
    }
  },

  async model(params) {
    let [chatChannel, channels] = await Promise.all([
      this.getChannel(params),
      this.chat.getChannels(),
    ]);

    return { chatChannel, channels };
  },

  async getChannel(params) {
    let channel = await this.chat.getChannelBy("title", params.channelTitle);
    if (!channel) {
      channel = await this.getChannelFromServer(params.channelTitle);
    }
    return channel;
    // if (params.previewing) {
    // We are previewing a channel, so we don't have it in the chat service
    // Fetch it using ajax.
    // return getChannelFromServer(params.channelTitle)
    // } else {
    // Since we aren't previewing can safely assume the channel is in chat service
    // return this.chat.getChannelBy("title", params.channelTitle);
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
