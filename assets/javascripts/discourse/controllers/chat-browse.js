import Controller from "@ember/controller";
import discourseComputed from "discourse-common/utils/decorators";
import { inject as service } from "@ember/service";

export default Controller.extend({
  chat: service(),

  @discourseComputed
  showChatLink() {
    return this.site.mobileView || !this.chat.getSidebarActive();
  },
});
