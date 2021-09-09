import Controller from "@ember/controller";
import { action } from "@ember/object";
import { ajax } from "discourse/lib/ajax";

export default Controller.extend({
  queryParams: ["messageId", "previewing", "id"],

  @action
  joinChannel() {
    this.setProperties({
      previewing: null,
      id: null
    })
    ajax(`/chat/chat_channels/${this.model.chatChannel.id}/follow`, { method: "POST" })
      .then((response) => {
        console.log(response)
      });
  },

  @action
  clearMessageId() {
    this.set("messageId", null);
  },
});
