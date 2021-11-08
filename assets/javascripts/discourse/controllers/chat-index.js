import Controller from "@ember/controller";
import showModal from "discourse/lib/show-modal";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";

export default Controller.extend({
  creatingDm: false,
  router: service(),

  @action
  openFollowModal() {
    showModal("chat-channel-settings");
  },

  @action
  startCreatingDm() {
    this.set("creatingDm", true);
  },

  @action
  afterDmCreation(chatChannel) {
    this.cancelDmCreation();
    this.router.transitionTo("chat.channel", chatChannel.title);
  },

  @action
  cancelDmCreation() {
    this.set("creatingDm", false);
  },
});
