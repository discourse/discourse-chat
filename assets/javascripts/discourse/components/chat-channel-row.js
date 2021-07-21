import Component from "@ember/component";
import discourseComputed from "discourse-common/utils/decorators";

export default Component.extend({
  channel: null,
  switchChannel: null,
  nested: false,

  click() {
    this.switchChannel(this.channel);
  },
});
