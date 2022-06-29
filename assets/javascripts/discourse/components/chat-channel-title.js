import discourseComputed from "discourse-common/utils/decorators";
import Component from "@ember/component";
import { gt, reads } from "@ember/object/computed";

export default Component.extend({
  tagName: "",
  channel: null,
  multiDm: gt("users.length", 1),
  users: reads("channel.chatable.users.[]"),
  unreadIndicator: false,

  @discourseComputed("users")
  usernames(users) {
    return users.mapBy("username").join(", ");
  },
});
