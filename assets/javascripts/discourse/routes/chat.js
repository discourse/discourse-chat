import DiscourseRoute from "discourse/routes/discourse";
import { defaultHomepage } from "discourse/lib/utilities";
import { inject as service } from "@ember/service";

export default DiscourseRoute.extend({
  chat: service(),

  beforeModel(params) {
    if (!this.currentUser?.can_chat || !this.siteSettings.topic_chat_enabled) {
      return this.transitionTo(`discovery.${defaultHomepage()}`);
    }
    if (params.to.name === "chat.channel") {
      // The target is a specific chat channel, so return and let
      // the chat-channel route handle it.
      return;
    }

    return this.chat.getIdealFirstChannelTitle().then((channelTitle) => {
      if (channelTitle) {
        return this.transitionTo("chat.channel", channelTitle);
      }
    });
  },
});
