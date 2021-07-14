import { ajax } from "discourse/lib/ajax";
import { h } from "virtual-dom";
import I18n from "I18n";
import { includeAttributes } from "discourse/lib/transform-post";
import { popupAjaxError } from "discourse/lib/ajax-error";
import TopicStatus from "discourse/raw-views/topic-status";
import { withPluginApi } from "discourse/lib/plugin-api";

function findParentWidget(widget, ofName) {
  while (widget) {
    if (widget.name === ofName) {
      return widget;
    }
    widget = widget.parentWidget;
  }
}

export default {
  name: "topic-chat-setup",
  initialize(container) {
    const appEvents = container.lookup("service:app-events");
    const currentUser = container.lookup("current-user:main");
    if (currentUser && currentUser.can_chat) {
      container.lookup("service:chat-service").start();
    }

    TopicStatus.reopen({
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

    // post widget attrs
    includeAttributes("chat_history");
    // TODO: need to extract extra fields from post.topic.details, topic.has_chat_history

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

    withPluginApi("0.11.0", (api) => {
      api.addPostMenuButton("chat", (attrs) => {
        // TODO: want an includeTopicAttributes. we want topic.has_chat_history
        if (!attrs.chat_history) {
          return {
            className: "hidden",
            disabled: "true",
          };
        }
        return {
          className: "show-chat",
          position: "first",
          contents: h("span", [attrs.chat_history.length.toString()]),
          action: "showChat",
          icon: "comment",
        };
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

      api.attachWidgetAction("post-article", "showChat", function () {
        this.state.chatShown = !this.state.chatShown;
        // TODO: this needs to be an ajax in case history is too long to deliver initially
      });

      api.decorateWidget("actions-summary:before", (dec) => {
        const targetWidget = findParentWidget(dec.widget, "post-article");
        if (targetWidget.state.chatShown) {
          return dec.widget.attach("tc-history-container", dec.attrs);
        }
      });

      api.attachWidgetAction("post", "deleteChat", function () {
        // TODO: is this the right place to handle this action?
        // core's post actions are handled on the topic, but we can't inject additional closures to the post stream
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
        toggleChat() {
          return doToggleChat(this.topic);
        },
      });

      api.modifyClass("component:topic-timeline", {
        toggleChat() {
          return doToggleChat(this.topic);
        },
      });

      api.reopenWidget("quick-access-profile", {
        openChat() {
          appEvents.trigger("chat:request-open");
        },
      });

      if (currentUser && currentUser.can_chat) {
        api.addQuickAccessProfileItem({
          action: "openChat",
          className: "open-chat",
          icon: "comment",
          content: I18n.t("chat.open"),
        });
      }
    });
  },
};
