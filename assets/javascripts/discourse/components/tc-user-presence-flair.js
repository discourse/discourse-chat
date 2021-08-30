import Component from "@ember/component";
import discourseComputed from "discourse-common/utils/decorators";
import { inject as service } from "@ember/service";

export default Component.extend({
  tagName: "div",
  classNames: ["tc-presence-flair"],
  classNameBindings: ["online"],
  chat: service(),

  @discourseComputed("chat.presenceChannel.users.[]", "user.id")
  online(users, userId) {
    return !!users?.find((u) => u.id === userId);
  },
});
