import Component from "@ember/component";
import { CHANNEL_STATUSES } from "discourse/plugins/discourse-chat/discourse/models/chat-channel";
import I18n from "I18n";
import { isTesting } from "discourse-common/config/environment";
import { later } from "@ember/runloop";
import { isEmpty } from "@ember/utils";
import discourseComputed from "discourse-common/utils/decorators";
import { action } from "@ember/object";
import { equal } from "@ember/object/computed";
import { ajax } from "discourse/lib/ajax";
import { inject as service } from "@ember/service";
import { popupAjaxError } from "discourse/lib/ajax-error";
import {
  EXISTING_TOPIC_SELECTION,
  NEW_TOPIC_SELECTION,
} from "discourse/plugins/discourse-chat/discourse/components/chat-to-topic-selector";

export default Component.extend({
  chat: service(),
  tagName: "",
  chatChannel: null,

  @discourseComputed()
  buttonLabel() {
    if (this.chatChannel.isClosed) {
      return "chat.channel_settings.open_channel";
    } else {
      return "chat.channel_settings.close_channel";
    }
  },

  @discourseComputed()
  instructions() {
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
  toggleChannelStatus() {
    return ajax(
      `/chat/chat_channels/${this.chatChannel.id}/toggle_open_status`,
      { method: "PUT" }
    )
      .then((response) => {
        if (this.chatChannel.isOpen) {
          this.chatChannel.set("status", CHANNEL_STATUSES.closed);
        } else {
          this.chatChannel.set("status", CHANNEL_STATUSES.open);
        }
        this.closeModal();
      })
      .catch(popupAjaxError);
  },
});
