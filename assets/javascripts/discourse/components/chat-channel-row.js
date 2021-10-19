import Component from "@ember/component";
import discourseComputed from "discourse-common/utils/decorators";
import { equal } from "@ember/object/computed";
import { inject as service } from "@ember/service";

export default Component.extend({
  channel: null,
  switchChannel: null,
  nested: false,
  isDirectMessageRow: equal("channel.chatable_type", "DirectMessageChannel"),
  router: service(),

  @discourseComputed("nested", "active", "channel.muted")
  rowClassNames(nested, active, muted) {
    const classes = ["chat-channel-row"];
    if (this.channel.chat_channels.length) {
      classes.push("has-children");
    }
    if (nested) {
      classes.push("nested");
    }
    if (active) {
      classes.push("active");
    }
    if (muted) {
      classes.push("muted");
    }
    return classes.join(" ");
  },

  click() {
    if (this.switchChannel) {
      return this.switchChannel(this.channel);
    }

    return false;
  },

  @discourseComputed("channel", "router.currentRoute")
  active(channel, currentRoute) {
    return (
      currentRoute?.name === "chat.channel" &&
      currentRoute?.params?.channelTitle === channel.title.toString(10)
    );
  },

  @discourseComputed("currentUser.chat_channel_tracking_state")
  unreadIndicatorClassName(trackingState) {
    return this.isDirectMessageRow ||
      trackingState[this.channel.id]?.unread_mentions > 0
      ? "chat-unread-urgent-indicator"
      : "chat-unread-indicator";
  },

  @discourseComputed("currentUser.chat_channel_tracking_state")
  hasUnread(trackingState) {
    return trackingState[this.channel.id]?.unread_count || 0;
  },
});
