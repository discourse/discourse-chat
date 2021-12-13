import { action } from "@ember/object";
import { popupAjaxError } from "discourse/lib/ajax-error";
import Controller from "@ember/controller";
import discourseComputed from "discourse-common/utils/decorators";
import { CHAT_SOUNDS } from "discourse/plugins/discourse-chat/discourse/initializers/chat-notification-sounds";

const chatAttrs = [
  "chat_enabled",
  "chat_isolated",
  "only_chat_push_notifications",
  "chat_sound",
];

export default Controller.extend({
  @discourseComputed
  chatSounds() {
    return Object.keys(CHAT_SOUNDS).map((value) => {
      return { name: I18n.t(`chat.sounds.${value}`), value };
    });
  },

  @action
  onChangeChatSound(sound) {
    if (sound) {
      const audio = new Audio(CHAT_SOUNDS[sound]);
      audio.play();
    }
    this.model.set("user_option.chat_sound", sound);
  },

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
