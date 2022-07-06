import DiscourseRoute from "discourse/routes/discourse";
import I18n from "I18n";
import { defaultHomepage } from "discourse/lib/utilities";
import { inject as service } from "@ember/service";
import { scrollTop } from "discourse/mixins/scroll-top";
import { schedule } from "@ember/runloop";

export default DiscourseRoute.extend({
  chat: service(),

  titleToken() {
    return I18n.t("chat.title_capitalized");
  },

  beforeModel() {
    if (!this.chat.userCanChat) {
      return this.transitionTo(`discovery.${defaultHomepage()}`);
    }
  },

  activate() {
    this.chat.set("fullScreenChatOpen", true);

    schedule("afterRender", () => {
      document.body.classList.add("has-full-page-chat");
    });
  },

  deactivate() {
    this.chat.set("fullScreenChatOpen", false);
    this.chat.setActiveChannel(null);
    schedule("afterRender", () => {
      document.body.classList.remove("has-full-page-chat");
      scrollTop();
    });
  },
});
