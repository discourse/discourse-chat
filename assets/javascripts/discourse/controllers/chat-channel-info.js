import Controller from "@ember/controller";
import { action, computed } from "@ember/object";
import { inject as service } from "@ember/service";
import { reads } from "@ember/object/computed";

export default class ChatChannelInfoIndexController extends Controller {
  @service router;
  @service chat;

  @computed("teamsSidebarOn")
  get wrapperClassNames() {
    const classNames = ["full-page-chat"];
    if (this.chat.sidebarActive) {
      classNames.push("teams-sidebar-on");
    }
    return classNames.join(" ");
  }

  @computed("model.chatChannel")
  get tabs() {
    const tabs = [];

    if (!this.model.chatChannel.isDirectMessageChannel) {
      tabs.push("about");
    }

    if (this.model.chatChannel.membershipsCount > 1) {
      tabs.push("members");
    }

    tabs.push("settings");

    return tabs;
  }

  @reads("router.currentRoute.localName") tab;

  @action
  onBackToChannel() {
    return this.chat.openChannel(this.model.chatChannel);
  }

  @action
  switchChannel(channel) {
    return this.chat.openChannel(channel);
  }
}
