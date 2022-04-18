import ChatChannel from "discourse/plugins/discourse-chat/discourse/models/chat-channel";
import discourseComputed from "discourse-common/utils/decorators";
import I18n from "I18n";
import RawTopicStatus from "discourse/raw-views/topic-status";
import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { withPluginApi } from "discourse/lib/plugin-api";

export const PLUGIN_ID = "discourse-chat";

function toggleChatForTopic(topic, appEvents, chat) {
  topic.set("has_chat_live", !topic.has_chat_live);

  const action = topic.has_chat_live ? "enable" : "disable";
  return ajax(`/chat/${action}`, {
    type: "POST",
    data: {
      chatable_type: "topic",
      chatable_id: topic.id,
    },
  })
    .then((response) => {
      if (topic.has_chat_live) {
        const channel = ChatChannel.create(response.chat_channel);
        topic.set("chat_channel", channel);
        chat.startTrackingChannel(channel);
      } else {
        chat.stopTrackingChannel(topic.chat_channel);
      }
      appEvents.trigger(`topic-chat-${action}`, topic);
    })
    .catch(popupAjaxError);
}

function makeTopicChanges(api, appEvents, chat) {
  RawTopicStatus.reopen({
    @discourseComputed
    statuses() {
      const results = this._super(...arguments);

      if (this.topic.has_chat_live && !this.topic.closed) {
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

      if (transformed.actionCode === "chat.enabled") {
        transformed.actionDescriptionWidget = "chat-state-post-small-action";
      }
    }
  });

  api.decorateWidget("topic-status:after", (dec) => {
    if (dec.attrs.topic.has_chat_live && !dec.attrs.topic.closed) {
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

  api.decorateWidget("timeline-footer-controls:after", (dec) => {
    if (dec.attrs.topic.has_chat_live && !dec.attrs.topic.closed) {
      return dec.widget.attach("topic-chat-button", dec.attrs.topic);
    }
  });

  api.modifyClass("component:topic-admin-menu-button", {
    pluginId: PLUGIN_ID,
    toggleChat() {
      return toggleChatForTopic(this.topic, appEvents, chat);
    },
  });

  api.modifyClass("component:topic-timeline", {
    pluginId: PLUGIN_ID,
    toggleChat() {
      return toggleChatForTopic(this.topic, appEvents, chat);
    },
  });
}

export default {
  name: "chat-topic-changes",
  initialize(container) {
    const chatService = container.lookup("service:chat");
    if (chatService.userCanChat) {
      const appEvents = container.lookup("service:app-events");
      withPluginApi("0.12.1", (api) => {
        makeTopicChanges(api, appEvents, chatService);
      });
    }
  },
};
