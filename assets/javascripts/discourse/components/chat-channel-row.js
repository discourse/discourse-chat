import Component from "@ember/component";
import { action } from "@ember/object";
import discourseComputed from "discourse-common/utils/decorators";

export default Component.extend({
  channel: null,
  switchChannel: null,
  expanded: true,
  nested: false,

  @discourseComputed("nested")
  classes(nested) {
    let classes = "chat-channel-row";
    if (nested) {
      classes += " nested";
    }
    return classes;
  },

  click() {
    this.switchChannel(this.channel);
  },

  @action
  toggleExpand() {
    this.set("expanded", !this.expanded);
  },
});
