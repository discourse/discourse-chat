import Component from "@ember/component";
import { computed } from "@ember/object";
import { isCollapsible } from "discourse/plugins/discourse-chat/discourse/components/chat-message-collapser";

export default Component.extend({
  classNames: "chat-message-text",

  cooked: null,
  uploads: null,
  message: null,
  edited: false,

  @computed("cooked", "uploads", "message")
  get isCollapsible() {
    return isCollapsible(this.cooked, this.uploads, this.message);
  },
});
