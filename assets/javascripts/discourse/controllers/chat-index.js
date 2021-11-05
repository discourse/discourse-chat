import Controller from "@ember/controller";
import showModal from "discourse/lib/show-modal";
import { action } from "@ember/object";

export default Controller.extend({
  @action
  openFollowModal() {
    showModal("chat-channel-settings");
  },

  @action
  startCreatingDm() {
    this.appEvents.trigger("chat:start-new-dm");
    return false;
  },
});
