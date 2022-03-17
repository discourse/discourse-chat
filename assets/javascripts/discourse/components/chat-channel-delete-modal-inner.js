import Component from "@ember/component";
import { isTesting } from "discourse-common/config/environment";
import { later } from "@ember/runloop";
import { isEmpty } from "@ember/utils";
import I18n from "I18n";
import discourseComputed from "discourse-common/utils/decorators";
import { action } from "@ember/object";
import { ajax } from "discourse/lib/ajax";
import { inject as service } from "@ember/service";
import { popupAjaxError } from "discourse/lib/ajax-error";

export default Component.extend({
  chat: service(),
  tagName: "",
  chatChannel: null,
  channelNameConfirmation: null,

  @discourseComputed("deleting", "channelNameConfirmation")
  buttonDisabled(deleting, channelNameConfirmation) {
    if (deleting) {
      return true;
    }

    if (
      isEmpty(channelNameConfirmation) ||
      channelNameConfirmation.toLowerCase() !==
        this.chatChannel.title.toLowerCase()
    ) {
      return true;
    }
    return false;
  },

  @action
  deleteChannel() {
    this.set("deleting", true);
    return ajax(`/chat/chat_channels/${this.chatChannel.id}.json`, {
      method: "DELETE",
      data: { channel_name_confirmation: this.channelNameConfirmation },
    })
      .then(() => {
        this.appEvents.trigger("modal-body:flash", {
          text: I18n.t("chat.channel_delete.process_started"),
          messageClass: "success",
        });
        later(() => {
          if (!isTesting()) {
            window.location.reload();
          }
        }, 3000);
      })
      .catch(popupAjaxError)
      .finally(() => this.set("deleting", false));
  },
});
