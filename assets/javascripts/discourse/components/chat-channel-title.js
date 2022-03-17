import discourseComputed from "discourse-common/utils/decorators";
import Component from "@ember/component";
import { action } from "@ember/object";
import { gt, reads } from "@ember/object/computed";

export default Component.extend({
  tagName: "",
  channel: null,
  multiDm: gt("users.length", 1),
  onClick: null,
  users: reads("channel.chatable.users.[]"),
  unreadIndicator: false,

  @discourseComputed("users")
  usernames(users) {
    return users.mapBy("username").join(", ");
  },

  @action
  handleOnClick(event) {
    return this.onClick?.(event);
  },
});
