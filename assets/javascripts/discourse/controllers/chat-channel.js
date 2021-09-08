import Controller from "@ember/controller";
import { action } from "@ember/object";

export default Controller.extend({
  queryParams: ["messageId"],

  @action
  clearMessageId() {
    this.set("messageId", null);
  },
});
