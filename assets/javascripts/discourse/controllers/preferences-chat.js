import { action } from "@ember/object";
import { popupAjaxError } from "discourse/lib/ajax-error";
import Controller from "@ember/controller";
import discourseComputed from "discourse-common/utils/decorators";

const chatAttrs = [
  "chat_enabled",
  "chat_isolated",
  "only_chat_push_notifications",
];

const CHAT_SOUNDS = ["none", "bell"];

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

  @discourseComputed
  chatSounds() {
    return CHAT_SOUNDS.map((value) => {
      return { name: I18n.t(`chat.sounds.${value}`), value };
    });
  },
});
