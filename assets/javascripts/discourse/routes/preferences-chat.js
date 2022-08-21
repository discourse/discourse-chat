import RestrictedUserRoute from "discourse/routes/restricted-user";
import { defaultHomepage } from "discourse/lib/utilities";
import { inject as service } from "@ember/service";

export default class PreferencesChatRoute extends RestrictedUserRoute {
  @service chat;

  showFooter = true;

  setupController(controller, user) {
    if (!user?.can_chat) {
      return this.transitionTo(`discovery.${defaultHomepage()}`);
    }
    controller.set("model", user);
  }
}
