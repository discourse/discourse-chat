import Component from "@ember/component";
import { action } from "@ember/object";
import discourseComputed from "discourse-common/utils/decorators";

export default Component.extend({
  channel: null,
  switchChannel: null,
  expanded: true,
  nested: false,

  click() {
    this.switchChannel(this.channel);
  },

  @action
  toggleExpand() {
    this.set("expanded", !this.expanded);
  },
});
