import Controller from "@ember/controller";
import { action } from "@ember/object";
import { ajax } from "discourse/lib/ajax";
import { inject as service } from "@ember/service";

export default Controller.extend({
  queryParams: ["messageId", "previewing", "id"],
  chat: service(),

  @action
  joinChannel() {
    return ajax(`/chat/chat_channels/${this.model.chatChannel.id}/follow`, {
      method: "POST",
    }).then(() => {
      this.setProperties({
        previewing: null,
        id: null,
      });
      this.chat.forceRefreshChannels().then(() => {
        this.send("refreshModel");
        this.appEvents.trigger("chat:refresh-channels");
      });
    });
  },

  @action
  clearMessageId() {
    this.set("messageId", null);
  },
});
