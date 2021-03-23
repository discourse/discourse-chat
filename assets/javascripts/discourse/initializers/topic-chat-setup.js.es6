import { withPluginApi } from "discourse/lib/plugin-api";
import I18n from "I18n";
import TopicStatus from "discourse/raw-views/topic-status";

export default {
  name: "topic-chat-setup",
  initialize() {
    TopicStatus.reopen({
      statuses: Ember.computed(function() {
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

    withPluginApi("0.11.0", (api) => {
      api.addPostMenuButton("chat-count", (attrs) => {
        if (!attrs.chat_enabled) {
          return {
            className: "hidden",
            disabled: "true",
          };
        }
        return {
          className: "button-count show-chat",
          contents: h("span", "9"), // TODO
          action: "showChat",
        };
      });
      api.addPostMenuButton("chat", (attrs) => {
        if (!attrs.chat_enabled) {
          return {
            className: "hidden",
            disabled: "true",
          };
        }
        return {
          className: "show-chat",
          before: "chat-count",
          action: "showChat",
          icon: "comment",
        };
      });
    });
  },
}
