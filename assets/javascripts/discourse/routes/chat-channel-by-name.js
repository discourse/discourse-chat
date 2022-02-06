import DiscourseRoute from "discourse/routes/discourse";
import Promise from "rsvp";
import EmberObject, { action } from "@ember/object";
import { ajax } from "discourse/lib/ajax";
import { inject as service } from "@ember/service";
export default DiscourseRoute.extend({
  chat: service(),

  async model(params) {
    return ajax(
      `/chat/chat_channels/${encodeURIComponent(params.channelName)}.json`
    )
      .then((response) => {
        this.transitionTo(
          "chat.channel",
          response.chat_channel.id,
          response.chat_channel.title
        );
      })
      .catch(() => this.replaceWith("/404"));
  },

  beforeModel() {
    if (!this.chat.userCanChat) {
      return this.transitionTo(`discovery.${defaultHomepage()}`);
    }
  },
});
