import Component from "@ember/component";
import discourseComputed from "discourse-common/utils/decorators";
import I18n from "I18n";

export default Component.extend({
  classNameBindings: [":topic-chat-float-container", "hidden"],

  hidden: true,

  selectedTopicId: null,
  selectedTopicTitle: null,

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
      this.set("selectedTopicTitle", topic.title);
      this.set("expanded", true);
      this.set("hidden", false);
    }
  },

  @discourseComputed("selectedTopicTitle")
  title(topicTitle) {
    if (topicTitle === null) {
      return I18n.t("chat.title_bare");
    } else {
      return I18n.t("chat.title_topic", {
        topic_title: topicTitle,
      });
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
