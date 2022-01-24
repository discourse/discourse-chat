import Controller from "@ember/controller";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";

export default Controller.extend({
  router: service(),

  @action
  selectChannel(channel) {
    return this.router.transitionTo("chat.channel", channel.id, channel.title);
  },
});
