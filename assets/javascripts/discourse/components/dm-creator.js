import Component from "@ember/component";
import { action } from "@ember/object";
import { empty } from "@ember/object/computed";
import { inject as service } from "@ember/service";

export default Component.extend({
  chat: service(),
  usernames: null,
  usernamesEmpty: empty("usernames"),

  @action
  createDmChannel() {
    if (this.usernamesEmpty) {
      return;
    }

    this.chat.getDmChannelForUsernames(this.usernames);
  },

  @action
  cancel() {
    this.set("usernames", null);
    this.onCancel();
  },

  @action
  onUsernamesChange(usernames) {
    this.set("usernames", usernames);
  },
});
