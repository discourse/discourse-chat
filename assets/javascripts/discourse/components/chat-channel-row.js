import discourseComputed from "discourse-common/utils/decorators";
import Component from "@ember/component";

export default Component.extend({
  channel: null,
  switchChannel: null,
  nested: false,

  click() {
    this.switchChannel(this.channel);
  },

  @discourseComputed(
    "currentUser.chat_channel_tracking_state.@each.unread_count"
  )
  unreadCount(trackingState) {
    return trackingState.findBy("chat_channel_id", this.channel.id)
      .unread_count;
  },
});
