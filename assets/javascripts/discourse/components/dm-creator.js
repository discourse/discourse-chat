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

    return ajax("/chat/direct_messages/create.json", {
      method: "POST",
      data: { usernames: this.usernames.uniq().join(",") },
    }).then((response) => {
      const chatChannel = ChatChannel.create(response.chat_channel);
      this.set("usernames", null);
      this.chat.startTrackingChannel(chatChannel);
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
