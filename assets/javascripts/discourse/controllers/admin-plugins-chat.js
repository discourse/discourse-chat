import Controller from "@ember/controller";
import { action } from "@ember/object";

export default Controller.extend({
  creatingNew: false,
  newWebhookName: "",
  newWebhookChannel: null,

  @action
  newWebhook() {
    this.set("creatingNew", true);
  },

  @action
  cancelNewWebhook() {
    this.setProperties({
      creatingNew: false,
      newWebhookName: "",
      newWebhookChannel: null
    });
  },
})
