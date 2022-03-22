import Component from "@ember/component";
import { action } from "@ember/object";
import { ajax } from "discourse/lib/ajax";
import { empty } from "@ember/object/computed";
import { inject as service } from "@ember/service";
import ChatChannel from "discourse/plugins/discourse-chat/discourse/models/chat-channel";

export default Component.extend({
  chat: service(),
  usernames: null,
  usernamesEmpty: empty("usernames"),

  @action
  createDmChannel() {
    if (this.usernamesEmpty) {
      return;
    }
    this.chat.getDmChannelForUsernames(this.usernames).then((chatChannel) => {
      this.set("usernames", null);
      this.afterCreate(chatChannel);
    });
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
