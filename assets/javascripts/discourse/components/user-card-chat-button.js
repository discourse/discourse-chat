import Component from "@ember/component";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";

export default Component.extend({
  chat: service(),

  @action
  startChatting() {
    this.chat
      .getDmChannelForUsernames([this.user.username]);
  },
});
