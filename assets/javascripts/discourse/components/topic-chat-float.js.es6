import Component from "@ember/component";
import discourseComputed from "discourse-common/utils/decorators";
import I18n from "I18n";
import { schedule, throttle } from "@ember/runloop";

export default Component.extend({
  classNameBindings: [":topic-chat-float-container", "hidden"],

  hidden: true,
  sizeTimer: null,

  selectedTopicId: null,
  selectedTopicTitle: null,

  didInsertElement() {
    this._super(...arguments);

    this.appEvents.on("header:update-topic", this, "enteredTopic");
    this.appEvents.on("composer:closed", this, "_checkSize");
    this.appEvents.on("composer:will-close", this, "_setSizeWillClose");
    this.appEvents.on("composer:opened", this, "_checkSize");
    this.appEvents.on("composer:resized", this, "_checkSize");
    this.appEvents.on("composer:div-resizing", this, "_dynamicCheckSize");
    this.appEvents.on("composer:resize-started", this, "_startDynamicCheckSize");
    this.appEvents.on("composer:resize-ended", this, "_clearDynamicCheckSize");
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

  _dynamicCheckSize() {
    if (!this.sizeTimer) {
      this.sizeTimer = window.requestAnimationFrame(() => this._performCheckSize());
    }
  },

  _startDynamicCheckSize() {
    this.element.classList.add("clear-transitions");
  },

  _clearDynamicCheckSize() {
    this.element.classList.remove("clear-transitions");
    this._checkSize();
  },

  _checkSize() {
    throttle(this, this._performCheckSize, 150);
  },

  _performCheckSize() {
    this.sizeTimer = null;
    if (!this.element || this.isDestroying || this.isDestroyed) {
      return;
    }

    const composer = document.getElementById("reply-control");

    this.element.style.setProperty("--composer-height", composer.offsetHeight + "px");
  },

  _setSizeWillClose() {
    if (!this.element || this.isDestroying || this.isDestroyed) {
      return;
    }
    const composer = document.getElementById("reply-control");
    // if overridden by themes, will get fixed up in the composer:closed event
    this.element.style.setProperty("--composer-height", "40px");
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
