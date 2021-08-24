import DiscourseRoute from "discourse/routes/discourse";
import { ajax } from "discourse/lib/ajax";
import { inject as service } from "@ember/service";

export default DiscourseRoute.extend({
  chat: service(),

  beforeModel(/* transition */) {
    if (!this.currentUser?.can_chat || !this.siteSettings.topic_chat_enabled) {
      this.transitionTo('discovery')
    }
    this.chat.getIdealFirstChannelId().then((channelId) => {
      this.transitionTo('chat.channel', channelId);
    });
  }
})
