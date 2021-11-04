import { action } from "@ember/object";
import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import Controller from "@ember/controller";

const chatAttrs = [
  "chat_enabled",
  "chat_isolated",
  "only_chat_push_notifications",
];
export default Controller.extend({
  setMinimalChatView() {
    this.model.minimalChatView
      ? localStorage.setItem("minimalChatView", true)
      : localStorage.removeItem("minimalChatView");
  },

  @action
  save() {
    this.set("saved", false);
    return this.model
      .save(chatAttrs)
      .then(() => {
        this.set("saved", true);
        this.setMinimalChatView();
        location.reload();
      })
      .catch(popupAjaxError);
  },
});
