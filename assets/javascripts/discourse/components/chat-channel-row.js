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

  @discourseComputed("nested", "active")
  rowClassNames(nested, active) {
    const classes = ["chat-channel-row"];
    if (nested) {
      classes.push("nested");
    }
    if (active) {
      classes.push("active");
    }
    return classes.join(" ");
  },

  click() {
    this.switchChannel(this.channel);
    return false;
  },

  @discourseComputed("channel", "router.currentRoute")
  active(channel, currentRoute) {
    return (
      currentRoute.name === "chat.channel" &&
      currentRoute.params.channelTitle === channel.title.toString(10)
    );
  },

  @discourseComputed("currentUser.chat_channel_tracking_state")
  unreadCount(trackingState) {
    return trackingState[this.channel.id]?.unread_count || 0;
  },
});
