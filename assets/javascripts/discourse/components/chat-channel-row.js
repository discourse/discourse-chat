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
});
