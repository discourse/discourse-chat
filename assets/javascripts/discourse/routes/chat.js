import DiscourseRoute from "discourse/routes/discourse";
import { inject as service } from "@ember/service";

export default DiscourseRoute.extend({
  chat: service(),

  beforeModel(params) {
    if (!this.currentUser?.can_chat || !this.siteSettings.topic_chat_enabled) {
      this.transitionTo("discovery");
    }
    if (params.to.name === "chat.channel") {
      // The target is a specific chat channel, so return and let
      // the chat-channel route handle it.
      return;
    }

    return this.chat.getIdealFirstChannelTitle().then((channelTitle) => {
      this.transitionTo("chat.channel", channelTitle);
    });
  },
});
