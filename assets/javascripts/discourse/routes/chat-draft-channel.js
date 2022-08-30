import DiscourseRoute from "discourse/routes/discourse";
import { inject as service } from "@ember/service";

export default class ChatDraftChannelRoute extends DiscourseRoute {
  @service chat;

  beforeModel() {
    if (!this.currentUser?.allowDirectMessages) {
      this.transitionTo("chat");
    }
  }

  activate() {
    this.chat.setActiveChannel(null);
  }
}
