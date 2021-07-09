import { action } from "@ember/object";
import { equal } from "@ember/object/computed";
import { ajax } from "discourse/lib/ajax";
import Component from "@ember/component";
import discourseComputed from "discourse-common/utils/decorators";
import getURL from "discourse-common/lib/get-url";
import I18n from "I18n";
import { cancel, throttle } from "@ember/runloop";

export const LIST_VIEW = "list_view";
export const CHAT_VIEW = "chat_view";
export default Component.extend({
  chatView: equal("view", CHAT_VIEW),

  classNameBindings: [":topic-chat-float-container", "hidden"],

  hidden: true,
  expanded: true, // TODO - false when not first-load topic
  showClose: true, // TODO - false when on same topic
  expectPageChange: false,
  sizeTimer: null,
  rafTimer: null,
  view: null,

  selectedTopicId: null,
  selectedTopicTitle: null,
  selectedTopicSlug: null,
  chatChannelId: null,
  chatChannelType: null,
  unreadMessageCount: 0,

  channels: null,

  didInsertElement() {
    this._super(...arguments);
    if (!this.currentUser || !this.currentUser.can_chat) return;

    this.appEvents.on("chat:request-open", this, "openChat");
    this.appEvents.on("page:topic-loaded", this, "enterChannel");
    this.appEvents.on("topic-chat-enable", this, "chatEnabledForTopic");
    this.appEvents.on("topic-chat-disable", this, "chatDisabledForTopic");
    this.appEvents.on("composer:closed", this, "_checkSize");
    this.appEvents.on("composer:will-close", this, "_setSizeWillClose");
    this.appEvents.on("composer:opened", this, "_checkSize");
    this.appEvents.on("composer:resized", this, "_checkSize");
    this.appEvents.on("composer:div-resizing", this, "_dynamicCheckSize");
    this.appEvents.on(
      "composer:resize-started",
      this,
      "_startDynamicCheckSize"
    );
    this.appEvents.on("composer:resize-ended", this, "_clearDynamicCheckSize");
  },

  willDestroyElement() {
    this._super(...arguments);
    if (!this.currentUser || !this.currentUser.can_chat) return;

    if (this.appEvents) {
      this.appEvents.off("chat:request-open", this, "openChat");
      this.appEvents.off("page:topic-loaded", this, "enterChannel");
      this.appEvents.off("topic-chat-enable", this, "chatEnabledForTopic");
      this.appEvents.off("topic-chat-disable", this, "chatDisabledForTopic");
      this.appEvents.off("composer:closed", this, "_checkSize");
      this.appEvents.off("composer:will-close", this, "_setSizeWillClose");
      this.appEvents.off("composer:opened", this, "_checkSize");
      this.appEvents.off("composer:resized", this, "_checkSize");
      this.appEvents.off("composer:div-resizing", this, "_dynamicCheckSize");
      this.appEvents.off(
        "composer:resize-started",
        this,
        "_startDynamicCheckSize"
      );
      this.appEvents.off(
        "composer:resize-ended",
        this,
        "_clearDynamicCheckSize"
      );
    }
    if (this.sizeTimer) {
      cancel(this.sizeTimer);
      this.sizeTimer = null;
    }
    if (this.rafTimer) {
      window.cancelAnimationFrame(this.rafTimer);
    }
  },

  enterChannel(topic) {
    if (topic && topic.has_chat_live) {
      this.setProperties({
        selectedTopicId: topic.id,
        selectedTopicTitle: topic.title,
        selectedTopicSlug: topic.slug,
        chatChannelId: topic.chat_channel_id,
        chatChannelType: topic.chat_channel_type,
        expanded: this.expectPageChange ? true : this.expanded,
        hidden: false,
        expectPageChange: false,
        view: CHAT_VIEW,
      });
    }
  },

  chatEnabledForTopic(topic) {
    if (!this.selectedTopicId || this.selectedTopicId === topic.id) {
      // Don't do anything if viewing another topic
      this.enterChannel(topic);
    }
  },

  chatDisabledForTopic(topic) {
    if (this.expanded && this.selectedTopicId === topic.id) {
      this.close();
    }
  },

  _dynamicCheckSize() {
    if (!this.rafTimer) {
      this.rafTimer = window.requestAnimationFrame(() => {
        this.rafTimer = null;
        this._performCheckSize();
      });
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
    this.sizeTimer = throttle(this, this._performCheckSize, 150);
  },

  _performCheckSize() {
    if (!this.element || this.isDestroying || this.isDestroyed) {
      return;
    }

    const composer = document.getElementById("reply-control");

    this.element.style.setProperty(
      "--composer-height",
      composer.offsetHeight + "px"
    );
  },

  _setSizeWillClose() {
    if (!this.element || this.isDestroying || this.isDestroyed) {
      return;
    }
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

  @discourseComputed("selectedTopicId", "selectedTopicSlug")
  selectedTopicLink(id, slug) {
    return getURL(`/t/${slug}/${id}/last`);
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
      return "angle-double-down";
    } else {
      return "angle-double-up";
    }
  },

  @discourseComputed("unreadMessageCount")
  showUnreadMessageCount(count) {
    return count > 0;
  },

  @action
  toggleExpand() {
    const old = this.expanded;
    this.set("expanded", !old);
    if (!old) {
      this.set("unreadMessageCount", 0);
    }
  },

  @action
  newMessageCb() {
    if (!this.expanded) {
      this.set("unreadMessageCount", this.get("unreadMessageCount") + 1);
    }
  },

  @action
  close() {
    this.setProperties({
      hidden: true,
      selectedTopicId: null,
      selectedTopicTitle: null,
    });
  },

  @action
  openChat() {
    ajax("/chat/index.json").then((channels) => {
      this.setProperties({
        channels: channels,
        hidden: false,
        expanded: true,
        view: LIST_VIEW,
      });
    });
  },

  @action
  switchChannel(channel) {
    const url = `/${channel.chatable_type == "Topic" ? "t" : "c"}/${
      channel.chatable_id
    }.json`;
    // This will be polymorphic. Just dealing with topics still for now.
    ajax(url).then((response) => {
      this.enterChannel(response);
    });
  },
});
