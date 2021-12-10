import { action } from "@ember/object";
import { popupAjaxError } from "discourse/lib/ajax-error";
import Controller from "@ember/controller";

const chatAttrs = [
  "chat_enabled",
  "chat_isolated",
  "only_chat_push_notifications",
];
export default Controller.extend({
  @action
  save() {
    this.set("saved", false);
    return this.model
      .save(chatAttrs)
      .then(() => {
        this.set("saved", true);
        location.reload();
      })
      .catch(popupAjaxError);
  },
});
