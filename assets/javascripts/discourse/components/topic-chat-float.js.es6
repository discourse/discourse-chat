import Component from "@ember/component";
import discourseComputed from "discourse-common/utils/decorators";

export default Component.extend({
  classNameBindings: [":topic-chat-float-container", "enabled"],

  @discourseComputed("expanded")
  containerClassNames(expanded) {
    if (expanded) {
      return "topic-chat-container expanded";
    } else {
      return "topic-chat-container";
    }
  },

  @discourseComputed("expanded")
  expandIcon(expanded) {
    if (expanded) {
      return "angle-double-up";
    } else {
      return "angle-double-down";
    }
  },

  actions: {
    toggleExpand() {
      this.set("expanded", !this.get("expanded"));
    },
  },
});
