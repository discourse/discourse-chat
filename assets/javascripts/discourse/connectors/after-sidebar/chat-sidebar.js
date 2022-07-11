import { action } from "@ember/object";
import { getOwner } from "discourse-common/lib/get-owner";

export default {
  @action
  switchChannel(channel) {
    const chat = getOwner(this).lookup("service:chat");
    chat.openChannel(channel);
  },
};
