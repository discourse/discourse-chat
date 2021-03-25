import { createWidget } from "discourse/widgets/widget";
import { h } from "virtual-dom";
import hbs from "discourse/widgets/hbs-compiler";
import { historyContainer } from "discourse/plugins/discourse-topic-chat/discourse/widgets/chat-message-render";
import I18n from "I18n";
import { includeAttributes } from "discourse/lib/transform-post";
import TopicStatus from "discourse/raw-views/topic-status";
import { withPluginApi } from "discourse/lib/plugin-api";

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

    // post widget attrs
    includeAttributes("chat_history");

    withPluginApi("0.11.0", (api) => {
      api.addPostMenuButton("chat", (attrs, _state, _siteSettings, menuSettings) => {
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

      api.attachWidgetAction("post-contents", "showChat", function() {
        this.state.chatShown = !this.state.chatShown;
        // TODO: this needs to be an ajax.
      });

      api.decorateWidget("post-contents:after-cooked", (dec) => {
        if (dec.state.chatShown) {
          return dec.widget.attach("tc-history-container", dec.attrs);
        }
      });
    });
  },
}
