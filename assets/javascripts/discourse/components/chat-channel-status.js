import discourseComputed from "discourse-common/utils/decorators";
import I18n from "I18n";
import Component from "@ember/component";
import { CHANNEL_STATUSES } from "discourse/plugins/discourse-chat/discourse/models/chat-channel";
import {
  channelStatusName,
  channelStatusIcon,
} from "discourse/plugins/discourse-chat/discourse/models/chat-channel";

export default Component.extend({
  tagName: "",
  channel: null,
  format: null,

  init() {
    this._super(...arguments);
    if (!["short", "long"].includes(this.format)) {
      this.set("format", "long");
    }
  },

  @discourseComputed("channel.status")
  channelStatusMessage(channelStatus) {
    if (channelStatus === CHANNEL_STATUSES.open) {
      return null;
    }

    if (this.format === "long") {
      return this._longStatusMessage(channelStatus);
    } else {
      return this._shortStatusMessage(channelStatus);
    }
  },

  @discourseComputed("channel.status")
  channelStatusIcon(channelStatus) {
    return channelStatusIcon(channelStatus);
  },

  _shortStatusMessage(channelStatus) {
    return channelStatusName(channelStatus);
  },

  _longStatusMessage(channelStatus) {
    switch (channelStatus) {
      case CHANNEL_STATUSES.closed:
        return I18n.t("chat.channel_status.closed_header");
        break;
      case CHANNEL_STATUSES.readOnly:
        return I18n.t("chat.channel_status.read_only_header");
        break;
      case CHANNEL_STATUSES.archived:
        return I18n.t("chat.channel_status.archived_header");
        break;
    }
  },
});
