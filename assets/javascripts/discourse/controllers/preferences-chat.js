import Controller from "@ember/controller";
import { isTesting } from "discourse-common/config/environment";
import discourseComputed from "discourse-common/utils/decorators";
import I18n from "I18n";
import { action } from "@ember/object";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { CHAT_SOUNDS } from "discourse/plugins/discourse-chat/discourse/initializers/chat-notification-sounds";

const CHAT_ATTRS = [
  "chat_enabled",
  "only_chat_push_notifications",
  "ignore_channel_wide_mention",
  "chat_sound",
  "chat_email_frequency",
];

const EMAIL_FREQUENCY_OPTIONS = [
  { name: I18n.t(`chat.email_frequency.never`), value: "never" },
  { name: I18n.t(`chat.email_frequency.when_away`), value: "when_away" },
];

export default class PreferencesChatController extends Controller {
  emailFrequencyOptions = EMAIL_FREQUENCY_OPTIONS;

  @discourseComputed
  chatSounds() {
    return Object.keys(CHAT_SOUNDS).map((value) => {
      return { name: I18n.t(`chat.sounds.${value}`), value };
    });
  }

  @action
  onChangeChatSound(sound) {
    if (sound && !isTesting()) {
      const audio = new Audio(CHAT_SOUNDS[sound]);
      audio.play();
    }
    this.model.set("user_option.chat_sound", sound);
  }

  @action
  save() {
    this.set("saved", false);
    return this.model
      .save(CHAT_ATTRS)
      .then(() => {
        this.set("saved", true);
        if (!isTesting()) {
          location.reload();
        }
      })
      .catch(popupAjaxError);
  }
}
