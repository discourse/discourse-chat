import Component from "@ember/component";

export default Component.extend({
  channel: null,
  switchChannel: null,
  nested: false,

  click() {
    this.switchChannel(this.channel);
  },
});
