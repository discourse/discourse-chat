import Controller from "@ember/controller";
import discourseComputed from "discourse-common/utils/decorators";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";
import { createDirectMessageChannelDraft } from "discourse/plugins/discourse-chat/discourse/models/chat-channel";

export default Controller.extend({
  router: service(),

  init() {
    this._super(...arguments);
    this.appEvents.on("chat-channel:deleted", (chatChannel) => {
      if (chatChannel.isCategoryChannel) {
        this.set(
          "model.categoryChannels",
          this.model.categoryChannels.filter(
            (chan) => chan.id !== chatChannel.id
          )
        );
      } else {
        this.set(
          "model.topicChannels",
          this.model.topicChannels.filter((chan) => chan.id !== chatChannel.id)
        );
      }
    });
  },

  @discourseComputed("model.categoryChannels", "model.topicChannels")
  noChannelsAvailable(categoryChannels, topicChannels) {
    return !categoryChannels.length && !topicChannels.length;
  },

  @action
  startCreatingDmChannel() {
    const channel = createDirectMessageChannelDraft();
    return this.router.transitionTo("chat.channel", channel.id, channel.title)
      .promise;
  },
});
