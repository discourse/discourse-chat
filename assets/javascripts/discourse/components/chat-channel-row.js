import Component from "@ember/component";
import discourseComputed from "discourse-common/utils/decorators";
import getURL from "discourse-common/lib/get-url";
import { equal } from "@ember/object/computed";
import { inject as service } from "@ember/service";
import { action } from "@ember/object";

export default Component.extend({
  channel: null,
  switchChannel: null,
  isDirectMessageRow: equal("channel.chatable_type", "DirectMessageChannel"),
  router: service(),
  chat: service(),

  @discourseComputed("active", "channel.muted")
  rowClassNames(active, muted) {
    const classes = ["chat-channel-row"];
    if (active) {
      classes.push("active");
    }
    if (muted) {
      classes.push("muted");
    }
    return classes.join(" ");
  },

  mouseDown(e) {
    if (e.which === 2) {
      // Middle mouse click
      window
        .open(
          getURL(`/chat/channel/${this.channel.id}/${this.channel.title}`),
          "_blank"
        )
        .focus();
    }
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
      currentRoute?.params?.channelId === channel.id.toString(10)
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

  @action
  async leaveChatChannel() {
    return this.chat.unfollowDirectMessageChannel(this.channel);
  },
});
