import Component from "@ember/component";
import { action } from "@ember/object";
export default Component.extend({
  @action
  onChangeChatEnabled(value) {
    this.set("category.custom_fields.has_chat_enabled", value ? "true" : null);
  },
});
