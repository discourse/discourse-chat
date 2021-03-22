import Component from "@ember/component";
import discourseComputed from "discourse-common/utils/decorators";

export default Component.extend({
  classNameBindings: [":topic-chat-float-container", "enabled"],

  selectedTopicId: 75,

  didInsertElement() {
    this._super(...arguments);

    this.appEvents.on("header:update-topic", this, "enteredTopic");
  },

  willDestroyElement() {
    this._super(...arguments);

    if (this.appEvents) {
      this.appEvents.off("header:update-topic", this, "enteredTopic");
    }
  },

  enteredTopic(topic) {
    if (topic.has_chat_live) {
      this.set("selectedTopicId", topic.id);
    }
  },

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
