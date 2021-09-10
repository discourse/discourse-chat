import I18n from "I18n";
import RawTopicStatus from "discourse/raw-views/topic-status";
import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { withPluginApi } from "discourse/lib/plugin-api";

const PLUGIN_ID = "discourse-topic-chat";

export default {
  name: "topic-chat-setup",
  initialize(container) {
    const appEvents = container.lookup("service:app-events");
    const chat = container.lookup("service:chat");
    chat.refreshChannels();
    const currentUser = container.lookup("current-user:main");

    RawTopicStatus.reopen({
      statuses: Ember.computed(function () {
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
      }),
    });

    function doToggleChat(topic) {
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

    withPluginApi("0.12.1", (api) => {
      api.addCardClickListenerSelector(".topic-chat-float-container");
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

      api.dispatchWidgetAppEvent(
        "site-header",
        "header-chat-link",
        "chat:rerender-header"
      );

      api.dispatchWidgetAppEvent(
        "sidebar-header",
        "header-chat-link",
        "chat:rerender-header"
      );

      api.modifyClass("component:topic-admin-menu-button", {
        pluginId: PLUGIN_ID,
        toggleChat() {
          return doToggleChat(this.topic);
        },
      });

      api.modifyClass("component:topic-timeline", {
        pluginId: PLUGIN_ID,
        toggleChat() {
          return doToggleChat(this.topic);
        },
      });

      if (currentUser?.can_chat) {
        api.addToHeaderIcons("header-chat-link");
      }
    });
  },
};
