import Component from "@ember/component";
import { action } from "@ember/object";

export default Component.extend({
  tagName: "",

  messageActions: null,

  @action
  handleSecondaryButtons(id) {
    this.messageActions?.[id]?.();
  },
});
