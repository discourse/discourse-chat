import DiscourseRoute from "discourse/routes/discourse";
import { ajax } from "discourse/lib/ajax";
import { inject as service } from "@ember/service";

export default DiscourseRoute.extend({
  chat: service(),

  model() {
    if (this.site.mobileView) {
      return this.chat.getChannels().then((channels) => {
        if (
          channels.publicChannels.length ||
          channels.directMessageChannels.length
        ) {
          return channels;
        }
      });
    }
  },

  setupController(controller, model) {
    this._super(...arguments);

    if (!model) {
      return ajax("/chat/chat_channels/all.json").then((channels) => {
        controller.setProperties({
          model: channels,
          blankPage: true,
        });
      });
    }
  },
});
