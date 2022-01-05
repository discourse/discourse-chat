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

  @discourseComputed("active", "channel.{id,muted}")
  rowClassNames(active, channel) {
    const classes = ["chat-channel-row", `chat-channel-${channel.id}`];
    if (active) {
      classes.push("active");
    }
    if (channel.muted) {
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

  @action
  async leaveChatChannel() {
    return this.chat.unfollowDirectMessageChannel(this.channel);
  },
});
