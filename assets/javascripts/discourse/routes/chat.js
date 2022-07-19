import DiscourseRoute from "discourse/routes/discourse";
import I18n from "I18n";
import { defaultHomepage } from "discourse/lib/utilities";
import { inject as service } from "@ember/service";
import { scrollTop } from "discourse/mixins/scroll-top";
import { schedule } from "@ember/runloop";
import { action } from "@ember/object";

export default DiscourseRoute.extend({
  chat: service(),
  router: service(),
  fullPageChat: service(),

  titleToken() {
    return I18n.t("chat.title_capitalized");
  },

  beforeModel(transition) {
    if (!this.chat.userCanChat) {
      return this.transitionTo(`discovery.${defaultHomepage()}`);
    }

    this.fullPageChat.enter(transition?.from);
  },

  activate() {
    schedule("afterRender", () => {
      document.body.classList.add("has-full-page-chat");
    });
  },

  deactivate() {
    this.fullPageChat.exit();
    this.chat.setActiveChannel(null);
    schedule("afterRender", () => {
      document.body.classList.remove("has-full-page-chat");
      scrollTop();
    });
  },
});
