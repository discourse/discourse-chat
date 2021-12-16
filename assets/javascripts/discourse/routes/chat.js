import DiscourseRoute from "discourse/routes/discourse";
import I18n from "I18n";
import { defaultHomepage } from "discourse/lib/utilities";
import { inject as service } from "@ember/service";

export default DiscourseRoute.extend({
  chat: service(),

  titleToken() {
    return I18n.t("chat.title_capitalized");
  },

  beforeModel(params) {
    if (
      !this.currentUser?.has_chat_enabled ||
      !this.siteSettings.chat_enabled
    ) {
      return this.transitionTo(`discovery.${defaultHomepage()}`);
    }
  },
});
