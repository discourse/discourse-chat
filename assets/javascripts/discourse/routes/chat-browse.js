import DiscourseRoute from "discourse/routes/discourse";
import ChatChannel from "discourse/plugins/discourse-chat/discourse/models/chat-channel";
import { ajax } from "discourse/lib/ajax";
import { inject as service } from "@ember/service";

export default DiscourseRoute.extend({
  chat: service(),

  model() {
    return ajax("/chat/chat_channels/all.json").then((channels) => {
      const categoryChannels = [];

      const allChannels = this.chat.sortPublicChannels(
        channels.map((channel) => ChatChannel.create(channel))
      );

      allChannels.forEach((channel) => {
        if (channel.isCategoryChannel) {
          categoryChannels.push(channel);
        }
      });

      return {
        categoryChannels,
      };
    });
  },
});
