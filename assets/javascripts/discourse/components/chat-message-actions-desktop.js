import Component from "@ember/component";
import { action } from "@ember/object";

export default Component.extend({
  tagName: "",

  messageActions: null,

  @action
  handlesecondaryButtons(id) {
    this.messageActions?.[id]?.();
  },
});
