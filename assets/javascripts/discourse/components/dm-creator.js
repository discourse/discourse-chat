import Component from "@ember/component";
import { action } from "@ember/object";
import { ajax } from "discourse/lib/ajax";
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

    return ajax("/chat/direct_messages/create.json", {
      method: "POST",
      data: { usernames: this.usernames.uniq().join(",") },
    }).then((response) => {
      this.set("usernames", null);
      this.chat.startTrackingChannel(response.chat_channel);
      this.afterCreate(response.chat_channel);
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
