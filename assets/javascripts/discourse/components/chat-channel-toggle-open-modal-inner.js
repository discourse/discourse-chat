import Component from "@ember/component";
import { CHANNEL_STATUSES } from "discourse/plugins/discourse-chat/discourse/models/chat-channel";
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

  get buttonLabel() {
    if (this.chatChannel.isClosed) {
      return "chat.channel_settings.open_channel";
    } else {
      return "chat.channel_settings.close_channel";
    }
  },

  get instructions() {
    if (this.chatChannel.isClosed) {
      return I18n.t("chat.channel_open.instructions");
    } else {
      return I18n.t("chat.channel_close.instructions");
    }
  },

  @discourseComputed()
  modalTitle() {
    if (this.chatChannel.isClosed) {
      return "chat.channel_open.title";
    } else {
      return "chat.channel_close.title";
    }
  },

  @action
  changeChannelStatus() {
    const status = this.chatChannel.isClosed
      ? CHANNEL_STATUSES.open
      : CHANNEL_STATUSES.closed;
    return ajax(`/chat/chat_channels/${this.chatChannel.id}/change_status.json`, {
      method: "PUT",
      data: { status },
    })
      .then(() => {
        this.chatChannel.set("status", status);
        this.closeModal();
      })
      .catch(popupAjaxError);
  },
});
