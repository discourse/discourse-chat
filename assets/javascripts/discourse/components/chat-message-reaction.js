import Component from "@ember/component";
import { emojiUnescape } from "discourse/lib/text";
import discourseComputed, { observes } from "discourse-common/utils/decorators";

export default Component.extend({
  active: false,
  classNames: "chat-message-reaction",
  classNameBindings: ["active"],

  // @discourseComputed("emoji")
  // emojiString(emoji) {
    // return `:${emoji}:`;
  // },

  click() {
    if (this.loading) {
      return;
    }
    this.set("loading", true);


    this.set("active", !this.active);
    this.set("loading", false);
  }
})
