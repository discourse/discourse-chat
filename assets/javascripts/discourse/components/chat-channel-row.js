import Component from "@ember/component";
import discourseComputed from "discourse-common/utils/decorators";
import getURL from "discourse-common/lib/get-url";
import { equal } from "@ember/object/computed";
import { inject as service } from "@ember/service";
import { action } from "@ember/object";

export default Component.extend({
  tagName: "",
  channel: null,
  switchChannel: null,
  isUnfollowing: false,
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

  @action
  handleNewWindow(event) {
    // Middle mouse click
    if (event.which === 2) {
      window
        .open(
          getURL(`/chat/channel/${this.channel.id}/${this.channel.title}`),
          "_blank"
        )
        .focus();
    }
  },

  @action
  handleSwitchChannel(event) {
    if (event.target.classList.contains("chat-channel-leave-btn")) {
      return;
    }

    if (this.switchChannel) {
      this.switchChannel(this.channel);
      event.preventDefault();
    }
  },

  @action
  onLeaveChannel() {
    this.set("isUnfollowing", true);
    this.chat.unfollowChannel(this.channel);
  },

  @discourseComputed("channel", "router.currentRoute")
  active(channel, currentRoute) {
    return (
      currentRoute?.name === "chat.channel" &&
      currentRoute?.params?.channelId === channel.id.toString(10)
    );
  },
});
