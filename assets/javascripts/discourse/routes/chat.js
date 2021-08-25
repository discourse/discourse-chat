import DiscourseRoute from "discourse/routes/discourse";
import { ajax } from "discourse/lib/ajax";
import { inject as service } from "@ember/service";

export default DiscourseRoute.extend({
  chat: service(),

  beforeModel(params) {
    if (!this.currentUser?.can_chat || !this.siteSettings.topic_chat_enabled) {
      this.transitionTo("discovery");
    }
    if (params.to.name === "chat.channel") {
      return;
    }

    this.chat.getIdealFirstChannelTitle().then((channelTitle) => {
      this.transitionTo("chat.channel", channelTitle);
    });
  },
});
