import DiscourseRoute from "discourse/routes/discourse";
import I18n from "I18n";
import { defaultHomepage } from "discourse/lib/utilities";
import { inject as service } from "@ember/service";

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
});
