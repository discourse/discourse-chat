import DiscourseRoute from "discourse/routes/discourse";
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
      this.chat.getChannelBy("title", params.channelTitle),
      this.chat.getChannels()
    ]);


    return { chatChannel, channels };
  },

  // setupController(controller, model) {
    // return this.chat.getChannels().then((channels) => {
      // controller.setProperties({
        // publicChannels: channels.publicChannels,
        // directMessageChannels: channels.directMessageChannels
      // })
    // });
  // },

  afterModel() {
    this.appEvents.trigger("chat:navigated-to-full-page");
  }
});
