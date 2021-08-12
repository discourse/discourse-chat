import discourseComputed from "discourse-common/utils/decorators";
import Component from "@ember/component";
import { gt } from "@ember/object/computed";

export default Component.extend({
  tagName: "",
  channel: null,
  multiDm: gt("channel.chatable.users.length", 1),

  @discourseComputed("channel.chatable.users")
  userCount(users) {
    return users.length;
  },

  @discourseComputed("channel.chatable.users")
  usernames(users) {
    return users.map((user) => user.username).join(", ");
  },

  @discourseComputed("channel.chatable.users")
  firstUser(users) {
    return users[0]; // Template has a hard time with this
  },
});
