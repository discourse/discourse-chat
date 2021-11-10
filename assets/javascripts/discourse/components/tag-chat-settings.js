import Component from "@ember/component";
import { action } from "@ember/object";
import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";

export default Component.extend({
  tag: null,
  loading: false,

  @action
  toggleChatEnabled() {
    this.set("loading", true);
    const action = this.tag.chat_enabled ? "disable" : "enable";
    return ajax(`/chat/${action}`, {
      type: "POST",
      data: {
        chatable_type: "tag",
        chatable_id: this.tag.id,
      },
    })
    .then(() => {
      this.tag.set("chat_enabled", !this.tag.chat_enabled);
    })
    .catch(popupAjaxError)
    .finally(() => this.set("loading", false));
  },
})
