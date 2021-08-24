import discourseComputed from "discourse-common/utils/decorators";
import Component from "@ember/component";
import { equal } from "@ember/object/computed";
import { inject as service } from "@ember/service";

export default Component.extend({
  channel: null,
  switchChannel: null,
  nested: false,
  isDirectMessageRow: equal("channel.chatable_type", "DirectMessageChannel"),
  router: service(),

  click() {

    if (this.router.currentRouteName === "chat.channel") {
      this.router.transitionTo('chat.channel', this.channel.title)
    } else {
      this.switchChannel(this.channel);
      return false; // Don't propogate click to potential parent channel
    }
  },

  @discourseComputed("currentUser.chat_channel_tracking_state")
  unreadCount(trackingState) {
    return trackingState[this.channel.id]?.unread_count || 0;
  },
});
