import discourseComputed from "discourse-common/utils/decorators";
import Component from "@ember/component";
import { equal } from "@ember/object/computed";

export default Component.extend({
  channel: null,
  switchChannel: null,
  nested: false,
  isDirectMessageRow: equal("channel.chatable_type", "DirectMessageChannel"),

  click() {
    this.switchChannel(this.channel);
    return false; // Don't propogate click to potential parent channel
  },

  @discourseComputed("currentUser.chat_channel_tracking_state")
  unreadCount(trackingState) {
    return trackingState[this.channel.id]?.unread_count || 0;
  },
});
