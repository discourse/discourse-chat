import DiscourseRoute from "discourse/routes/discourse";
import EmberObject from "@ember/object";
import { ajax } from "discourse/lib/ajax";
import { inject as service } from "@ember/service";

export default DiscourseRoute.extend({
  chat: service(),
  model() {
    return ajax("/chat/chat_channels/all.json").then((channels) => {
      const categoryChannels = [];
      const topicChannels = [];

      const allChannels = this.chat.sortPublicChannels(
        channels.map((channel) => EmberObject.create(channel))
      );

      allChannels.forEach((channel) => {
        if (channel.chatable_type === "Category") {
          categoryChannels.push(channel);
        } else {
          topicChannels.push(channel);
        }
      });

      return {
        categoryChannels,
        topicChannels,
      };
    });
  },
});
