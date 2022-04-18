import Component from "@ember/component";
import discourseComputed from "discourse-common/utils/decorators";
import { inject as service } from "@ember/service";

export default Component.extend({
  tagName: "",

  chat: service(),

  user: null,

  avatarSize: "tiny",

  @discourseComputed("chat.presenceChannel.users.[]", "user.{id,username}")
  isOnline(users, user) {
    return (
      !!users?.findBy("id", user?.id) ||
      !!users?.findBy("username", user?.username)
    );
  },
});
