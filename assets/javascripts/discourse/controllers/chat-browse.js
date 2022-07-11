import Controller from "@ember/controller";
import discourseComputed from "discourse-common/utils/decorators";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";

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
      }
    });
  },

  @discourseComputed("model.categoryChannels")
  noChannelsAvailable(categoryChannels) {
    return !categoryChannels.length;
  },

  @action
  startCreatingDmChannel() {
    return this.router.transitionTo("chat.draft-channel");
  },
});
