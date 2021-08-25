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

  model(params) {
    console.log(params)
    return this.chat.getChannelBy("title", params.channelTitle);
  },

  afterModel() {
    this.appEvents.trigger("chat:navigated-to-full-page");
  }
});
