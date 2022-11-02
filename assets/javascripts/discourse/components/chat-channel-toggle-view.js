import Component from "@ember/component";
import { htmlSafe } from "@ember/template";
import { CHANNEL_STATUSES } from "discourse/plugins/chat/discourse/models/chat-channel";
import I18n from "I18n";
import { action, computed } from "@ember/object";
import { ajax } from "discourse/lib/ajax";
import { inject as service } from "@ember/service";
import { popupAjaxError } from "discourse/lib/ajax-error";

export default class ChatChannelToggleView extends Component {
  @service chat;
  @service router;
  tagName = "";
  channel = null;
  onStatusChange = null;

  @computed("channel.isClosed")
  get buttonLabel() {
    if (this.channel.isClosed) {
      return "chat.channel_settings.open_channel";
    } else {
      return "chat.channel_settings.close_channel";
    }
  }

  @computed("channel.isClosed")
  get instructions() {
    if (this.channel.isClosed) {
      return htmlSafe(I18n.t("chat.channel_open.instructions"));
    } else {
      return htmlSafe(I18n.t("chat.channel_close.instructions"));
    }
  }

  @computed("channel.isClosed")
  get modalTitle() {
    if (this.channel.isClosed) {
      return "chat.channel_open.title";
    } else {
      return "chat.channel_close.title";
    }
  }

  @action
  changeChannelStatus() {
    const status = this.channel.isClosed
      ? CHANNEL_STATUSES.open
      : CHANNEL_STATUSES.closed;

    return ajax(`/chat/chat_channels/${this.channel.id}/change_status.json`, {
      method: "PUT",
      data: { status },
    })
      .then(() => {
        this.channel.set("status", status);
      })
      .catch(popupAjaxError)
      .finally(() => {
        this.onStatusChange?.(this.channel);
      });
  }
}
