import Controller from "@ember/controller";
import discourseComputed from "discourse-common/utils/decorators";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";
export default Controller.extend({
  creatingDm: false,
  router: service(),

  @discourseComputed("model.categoryChannels", "model.topicChannels")
  noChannelsAvailable(categoryChannels, topicChannels) {
    return !categoryChannels.length && !topicChannels.length;
  },

  @action
  startCreatingDm() {
    this.set("creatingDm", true);
  },

  @action
  afterDmCreation(chatChannel) {
    this.cancelDmCreation();
    this.router.transitionTo("chat.channel", chatChannel.id, chatChannel.title);
  },

  @action
  cancelDmCreation() {
    this.set("creatingDm", false);
  },
});
