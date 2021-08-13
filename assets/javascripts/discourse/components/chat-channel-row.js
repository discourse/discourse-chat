import discourseComputed from "discourse-common/utils/decorators";
import Component from "@ember/component";

export default Component.extend({
  channel: null,
  switchChannel: null,
  nested: false,

  click() {
    this.switchChannel(this.channel);
  },

  @discourseComputed("currentUser.chat_channel_tracking_state")
  unreadCount(trackingState) {
    return trackingState[this.channel.id]?.unread_count || 0;
  },
});
