import DiscourseRoute from "discourse/routes/discourse";
import EmberObject from "@ember/object";
import { ajax } from "discourse/lib/ajax";
import { inject as service } from "@ember/service";

export default DiscourseRoute.extend({
  chat: service(),
  model() {
    return ajax("/chat/chat_channels/all.json").then((channels) => {
      return {
        channels: this.chat.sortPublicChannels(
          channels.map((channel) => EmberObject.create(channel))
        ),
      };
    });
  },
});
