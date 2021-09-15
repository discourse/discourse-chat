import discourseComputed from "discourse-common/utils/decorators";
import Component from "@ember/component";
import { gt } from "@ember/object/computed";

export default Component.extend({
  tagName: "span",
  classNameBindings: [":chat-channel-title","unreadCount:has-unread"],
  channel: null,
  multiDm: gt("channel.chatable.users.length", 1),

  @discourseComputed("channel.chatable.users")
  usernames(users) {
    return users.map((user) => user.username).join(", ");
  },
});
