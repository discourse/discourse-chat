import Component from "@ember/component";
import discourseComputed from "discourse-common/utils/decorators";
import { inject as service } from "@ember/service";

export default Component.extend({
  tagName: "",

  chat: service(),

  user: null,

  avatarSize: "tiny",

  @discourseComputed("chat.presenceChannel.users.[]", "user.id")
  isOnline(users, userId) {
    return !!users?.findBy("id", userId);
  },
});
