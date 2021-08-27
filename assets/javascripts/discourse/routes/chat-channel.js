import DiscourseRoute from "discourse/routes/discourse";
import Promise from "rsvp";
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
      this.chat.getChannelBy("title", params.channelTitle),
      this.chat.getChannels()
    ]);

    return { chatChannel, channels };
  },

  afterModel() {
    this.appEvents.trigger("chat:navigated-to-full-page");
  }
});
