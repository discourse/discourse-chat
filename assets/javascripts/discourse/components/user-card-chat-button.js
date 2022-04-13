import Component from "@ember/component";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";

export default Component.extend({
  chat: service(),

  @action
  startChatting() {
    this.chat
      .upsertDmChannelForUsernames([this.user.username])
      .then((chatChannel) => {
        this.appEvents.trigger("chat:open-channel", chatChannel);
        this.appEvents.trigger("card:close");
      });
  },
});
