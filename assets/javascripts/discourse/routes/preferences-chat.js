import RestrictedUserRoute from "discourse/routes/restricted-user";
import { defaultHomepage } from "discourse/lib/utilities";

export default RestrictedUserRoute.extend({
  showFooter: true,

  setupController(controller, user) {
    if (!user?.can_chat) {
      return this.transitionTo(`discovery.${defaultHomepage()}`);
    }

    user.set(
      "minimalChatView",
      localStorage.getItem("minimalChatView") || false
    );
    controller.set("model", user);
  },
});
