import discourseComputed from "discourse-common/utils/decorators";
import I18n from "I18n";
import Component from "@ember/component";
import { CHANNEL_STATUSES } from "discourse/plugins/discourse-chat/discourse/models/chat-channel";

export default Component.extend({
  tagName: "",
  channel: null,

  @discourseComputed("channel.status")
  channelStatusMessage(channelStatus) {
    if (channelStatus === CHANNEL_STATUSES.open) {
      return null;
    }

    switch (channelStatus) {
      case CHANNEL_STATUSES.closed:
        if (this.currentUser.staff) {
          return I18n.t("chat.channel_status.closed_staff_header");
        } else {
          return I18n.t("chat.channel_status.closed_header");
        }
        break;
      case CHANNEL_STATUSES.readOnly:
        return I18n.t("chat.channel_status.read_only_header");
        break;
      case CHANNEL_STATUSES.archived:
        return I18n.t("chat.channel_status.archived_header");
        break;
    }
  },

  @discourseComputed("channel.status")
  channelStatusIcon(channelStatus) {
    if (channelStatus === CHANNEL_STATUSES.open) {
      return null;
    }

    switch (channelStatus) {
      case CHANNEL_STATUSES.closed:
        return "lock";
        break;
      case CHANNEL_STATUSES.readOnly:
        // FIXME (martin): Use a pencil-slash icon here, we don't have one in FA5
        return "far-eye";
        break;
      case CHANNEL_STATUSES.archived:
        return "folder";
        break;
    }
  },
});
