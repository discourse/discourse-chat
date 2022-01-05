import discourseComputed from "discourse-common/utils/decorators";
import Component from "@ember/component";
import { gt } from "@ember/object/computed";

export default Component.extend({
  classNameBindings: [":chat-channel-title"],
  channel: null,
  multiDm: gt("channel.chatable.users.length", 1),

  @discourseComputed("channel.chatable.users")
  usernames(users) {
    return users.mapBy("username").join(", ");
  },

  click() {
    return this.onClick?.();
  },
});
