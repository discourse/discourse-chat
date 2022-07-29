import DiscourseRoute from "discourse/routes/discourse";
import { inject as service } from "@ember/service";
import { ORIGINS } from "discourse/plugins/discourse-chat/discourse/services/chat-channel-info-route-origin-manager";

export default class ChatChannelInfoRoute extends DiscourseRoute {
  @service chatChannelInfoRouteOriginManager;

  activate(transition) {
    const name = transition?.from?.name;
    if (name) {
      this.chatChannelInfoRouteOriginManager.origin = name.startsWith(
        "chat.browse"
      )
        ? ORIGINS.browse
        : ORIGINS.channel;
    }
  }

  deactivate() {
    this.chatChannelInfoRouteOriginManager.origin = null;
  }
}
