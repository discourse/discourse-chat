import discourseComputed from "discourse-common/utils/decorators";
import I18n from "I18n";
import RawTopicStatus from "discourse/raw-views/topic-status";
import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { withPluginApi } from "discourse/lib/plugin-api";

export const PLUGIN_ID = "discourse-topic-chat";

function toggleChatForTopic(topic, appEvents) {
  topic.set("has_chat_live", !topic.has_chat_live);

  const action = topic.has_chat_live ? "enable" : "disable";
  return ajax(`/chat/${action}`, {
    type: "POST",
    data: {
      chatable_type: "topic",
      chatable_id: topic.id,
    },
  })
    .then(() => {
      appEvents.trigger(`topic-chat-${action}`, topic);
    })
    .catch(popupAjaxError);
}

function makeTopicChanges(api, appEvents) {
  RawTopicStatus.reopen({
    @discourseComputed
    statuses() {
      const results = this._super(...arguments);

      if (this.topic.has_chat_live) {
        results.push({
          openTag: "span",
          closeTag: "span",
          title: I18n.t("topic_statuses.chat.help"),
          icon: "far-comments",
          key: "topic-chat",
        });
      }
      return results;
    },
  });

  api.addPostSmallActionIcon("chat.enabled", "comment");
  api.addPostSmallActionIcon("chat.disabled", "comment");
  api.addPostTransformCallback((transformed) => {
    if (
      transformed.actionCode === "chat.enabled" ||
      transformed.actionCode === "chat.disabled"
    ) {
      transformed.isSmallAction = true;
      transformed.canEdit = false;
    }
  });

  api.decorateWidget("topic-status:after", (dec) => {
    if (dec.attrs.topic.has_chat_live) {
      return dec.widget.attach("topic-title-chat-link", dec.attrs.topic);
    }
  });

  api.decorateWidget("topic-admin-menu:adminMenuButtons", (dec) => {
    const topic = dec.attrs.topic;
    const { canManageTopic } = dec.widget.currentUser || {};
    if (!canManageTopic) {
      return;
    }

    dec.widget.addActionButton({
      className: "topic-admin-chat",
      buttonClass: "popup-menu-btn",
      action: "toggleChat",
      icon: topic.has_chat_live ? "comment-slash" : "comment",
      label: topic.has_chat_live
        ? "actions.chat_disable"
        : "actions.chat_enable",
    });
  });

  api.modifyClass("component:topic-admin-menu-button", {
    pluginId: PLUGIN_ID,
    toggleChat() {
      return toggleChatForTopic(this.topic, appEvents);
    },
  });

  api.modifyClass("component:topic-timeline", {
    pluginId: PLUGIN_ID,
    toggleChat() {
      return toggleChatForTopic(this.topic, appEvents);
    },
  });
}

export default {
  name: "chat-topic-changes",
  initialize(container) {
    const currentUser = container.lookup("current-user:main");
    if (currentUser?.has_chat_enabled) {
      const appEvents = container.lookup("service:app-events");
      withPluginApi("0.12.1", (api) => {
        makeTopicChanges(api, appEvents);
      });
    }
  },
};
